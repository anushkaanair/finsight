"""
FinSight — Management Credibility Engine
=========================================
Multi-dimensional scoring of how accurately management's forward guidance
predicted actual company outcomes across consecutive quarters.

COMPONENTS (weighted):
  1. Tone Accuracy         (30%) — did optimism/caution predict actual sentiment?
  2. Directional Accuracy  (25%) — did they call improvement vs deterioration?
  3. Risk Transparency     (20%) — were risk disclosures proactive and honest?
  4. Specificity           (10%) — how accountable was the guidance (vague vs concrete)?
  5. Financial Alignment   (15%) — did tone align with actual revenue / margin moves?

Each component scores 0.0–1.0. Composite maps to delta [-1, +1].
Cumulative score uses exponential recency decay so recent quarters matter more.

Rating bands:
  85–100  Goldman Tier       — highly reliable, institutional-grade management
  70–84   Credible           — consistent with occasional miss, trustworthy
  55–69   Mixed Signals      — unpredictable, use with caution
  40–54   Questionable       — frequent guidance misses, elevated skepticism
  0–39    Smoke & Mirrors    — management guidance has little predictive value
"""
from __future__ import annotations
import re
import math


# ── financial value parser ────────────────────────────────────────────────────

def _parse_fin(val: str | None) -> float | None:
    """Parse formatted financial strings like '$94.8B', '$1.53', '45.5%' → float."""
    if not val:
        return None
    s = str(val).replace(",", "").replace("$", "").replace("%", "").strip()
    multiplier = 1.0
    if s.upper().endswith("B"):
        multiplier, s = 1_000_000_000, s[:-1]
    elif s.upper().endswith("M"):
        multiplier, s = 1_000_000, s[:-1]
    elif s.upper().endswith("K"):
        multiplier, s = 1_000, s[:-1]
    try:
        return float(s) * multiplier
    except ValueError:
        return None


# ── component scorers ─────────────────────────────────────────────────────────

def _tone_accuracy(prev_guidance: list, curr_sentiment: dict) -> float | None:
    """
    How well did management's tone (optimistic/cautious mix) predict
    the actual FinBERT positivity of the next quarter's filing?

    Returns 0–1. None if no forward guidance was given.
    """
    opt  = sum(1 for g in prev_guidance if g.get("tag") == "optimistic")
    caut = sum(1 for g in prev_guidance if g.get("tag") == "cautious")
    total = opt + caut
    if total == 0:
        return None

    optimism_ratio = opt / total
    actual_pos     = curr_sentiment.get("score", {}).get("positive", 0.5)

    # Raw agreement: 1 = perfectly aligned, 0 = completely opposite
    agreement = 1.0 - abs(optimism_ratio - actual_pos)

    # Bonus for calling a negative quarter correctly (harder + more valuable)
    if optimism_ratio < 0.4 and actual_pos < 0.4:
        agreement = min(1.0, agreement + 0.08)

    return round(agreement, 3)


def _directional_accuracy(
    prev_guidance: list,
    prev_sentiment: dict,
    curr_sentiment: dict,
) -> float | None:
    """
    Did management correctly predict the *direction* of change?
    (Improving vs. deteriorating vs. stable)
    """
    opt  = sum(1 for g in prev_guidance if g.get("tag") == "optimistic")
    caut = sum(1 for g in prev_guidance if g.get("tag") == "cautious")
    total = opt + caut
    if total == 0 or not prev_sentiment:
        return None

    prev_pos = prev_sentiment.get("score", {}).get("positive", 0.5)
    curr_pos = curr_sentiment.get("score", {}).get("positive", 0.5)
    optimism_ratio = opt / total

    actual_dir = (
        "up"   if curr_pos > prev_pos + 0.025 else
        "down" if curr_pos < prev_pos - 0.025 else
        "flat"
    )
    pred_dir = (
        "up"   if optimism_ratio > 0.6 else
        "down" if optimism_ratio < 0.4 else
        "flat"
    )

    if pred_dir == actual_dir:
        # Perfect directional call — bigger bonus for calling a downturn
        return 1.0 if actual_dir == "down" else 0.85
    elif (pred_dir == "up" and actual_dir == "flat") or \
         (pred_dir == "flat" and actual_dir == "up"):
        return 0.6   # close enough
    elif (pred_dir == "down" and actual_dir == "flat") or \
         (pred_dir == "flat" and actual_dir == "down"):
        return 0.45  # slightly off
    else:
        # Called the wrong direction entirely
        return 0.1 if actual_dir == "down" else 0.25  # missed downturn = worst miss


def _specificity(prev_guidance: list) -> float:
    """
    How accountable was management's guidance?
    More signals + balanced mix (not all cheerleading) = higher score.

    Returns 0–1.
    """
    n = len(prev_guidance)
    if n == 0:
        return 0.0

    opt  = sum(1 for g in prev_guidance if g.get("tag") == "optimistic")
    caut = sum(1 for g in prev_guidance if g.get("tag") == "cautious")
    total = opt + caut

    # Volume score: more signals = more accountability
    volume_score = min(1.0, n / 8)  # caps at 8 signals

    # Balance score: 50/50 mix is most credible (not pure cheerleading)
    if total > 0:
        balance = 1.0 - abs((opt / total) - 0.5) * 1.4
        balance = max(0.0, min(1.0, balance))
    else:
        balance = 0.3

    # Keyword specificity: do signals contain numbers or concrete terms?
    concrete_keywords = re.compile(
        r"\b(\d+%|\d+\s*(?:percent|billion|million)|"
        r"q[1-4]|next quarter|fiscal \d{4}|"
        r"mid-single|double.digit|high single)\b",
        re.IGNORECASE,
    )
    texts = [g.get("text", "") for g in prev_guidance]
    concrete_count = sum(1 for t in texts if concrete_keywords.search(t))
    concrete_ratio = concrete_count / max(n, 1)
    keyword_score  = 0.4 + 0.6 * concrete_ratio  # 0.4 floor even if vague

    return round((volume_score * 0.4 + balance * 0.35 + keyword_score * 0.25), 3)


def _risk_transparency(
    prev_risk_delta: dict | None,
    curr_risk_delta: dict | None,
) -> float:
    """
    How honest and proactive was management about risk disclosures?

    Logic:
    - Proactively adding new risks last quarter = transparent
    - Many risks appearing suddenly this quarter = prior concealment
    - Removing resolved risks cleanly = good housekeeping
    - Flood of new risks this quarter that weren't flagged = red flag

    Returns 0–1.
    """
    if curr_risk_delta is None:
        return 0.5  # neutral default

    newly_added   = len(curr_risk_delta.get("added",   []))
    newly_removed = len(curr_risk_delta.get("removed", []))

    # Baseline
    score = 0.65

    # Reward resolving risks
    score += min(0.15, newly_removed * 0.05)

    # Penalise sudden flood of new undisclosed risks
    if newly_added >= 6:
        score -= 0.35
    elif newly_added >= 4:
        score -= 0.20
    elif newly_added >= 2:
        score -= 0.08
    elif newly_added == 0:
        score += 0.10  # stable risk landscape

    # Prior proactive disclosure bonus
    if prev_risk_delta:
        prev_added = len(prev_risk_delta.get("added", []))
        if 1 <= prev_added <= 3:
            score += 0.08  # disclosed a couple last time = transparent

    return round(max(0.0, min(1.0, score)), 3)


def _financial_alignment(
    prev_guidance: list,
    curr_financials: dict | None,
    prev_financials: dict | None,
) -> float | None:
    """
    Did management's optimism/caution predict actual financial performance?
    Uses revenue growth and gross margin as ground truth.

    Returns 0–1, or None if financial data is insufficient.
    """
    opt  = sum(1 for g in prev_guidance if g.get("tag") == "optimistic")
    caut = sum(1 for g in prev_guidance if g.get("tag") == "cautious")
    total = opt + caut
    if total == 0 or not curr_financials or not prev_financials:
        return None

    optimism_ratio = opt / total
    signals = []

    # Revenue growth
    curr_rev = _parse_fin(curr_financials.get("revenue"))
    prev_rev = _parse_fin(prev_financials.get("revenue"))
    if curr_rev and prev_rev and prev_rev > 0:
        rev_growth = (curr_rev - prev_rev) / prev_rev
        grew = rev_growth > 0.02
        if (optimism_ratio > 0.55 and grew) or (optimism_ratio < 0.45 and not grew):
            signals.append(0.9)  # aligned
        elif optimism_ratio > 0.55 and not grew:
            signals.append(0.15)  # overpromised, revenue fell
        elif optimism_ratio < 0.45 and grew:
            signals.append(0.55)  # too cautious, outperformed
        else:
            signals.append(0.6)

    # Gross margin trend
    curr_gm = _parse_fin(curr_financials.get("gross_margin"))
    prev_gm = _parse_fin(prev_financials.get("gross_margin"))
    if curr_gm and prev_gm:
        margin_improved = curr_gm > prev_gm + 0.5
        if (optimism_ratio > 0.55 and margin_improved) or \
           (optimism_ratio < 0.45 and not margin_improved):
            signals.append(0.85)
        elif optimism_ratio > 0.55 and not margin_improved:
            signals.append(0.3)
        else:
            signals.append(0.6)

    if not signals:
        return None
    return round(sum(signals) / len(signals), 3)


# ── master scorer ─────────────────────────────────────────────────────────────

WEIGHTS = {
    "tone_accuracy":       0.30,
    "directional_accuracy":0.25,
    "risk_transparency":   0.20,
    "financial_alignment": 0.15,
    "specificity":         0.10,
}


def compute_credibility_delta(
    prev_guidance:    list,
    curr_sentiment:   dict,
    prev_sentiment:   dict | None = None,
    curr_financials:  dict | None = None,
    prev_financials:  dict | None = None,
    curr_risk_delta:  dict | None = None,
    prev_risk_delta:  dict | None = None,
) -> dict:
    """
    Compute a full multi-dimensional credibility delta for one quarter.

    Returns a dict with:
      delta      — composite score, -1.0 to +1.0
      components — individual component scores (0–1 each)
      meta       — guidance count, optimism_ratio, etc.
    """
    opt  = sum(1 for g in prev_guidance if g.get("tag") == "optimistic")
    caut = sum(1 for g in prev_guidance if g.get("tag") == "cautious")
    total = opt + caut

    components = {
        "tone_accuracy":       _tone_accuracy(prev_guidance, curr_sentiment),
        "directional_accuracy":_directional_accuracy(prev_guidance, prev_sentiment, curr_sentiment) if prev_sentiment else None,
        "specificity":         _specificity(prev_guidance),
        "risk_transparency":   _risk_transparency(prev_risk_delta, curr_risk_delta),
        "financial_alignment": _financial_alignment(prev_guidance, curr_financials, prev_financials),
    }

    # Weighted composite (skip None components, redistribute weight)
    weighted_sum  = 0.0
    active_weight = 0.0
    for key, weight in WEIGHTS.items():
        val = components[key]
        if val is not None:
            weighted_sum  += val * weight
            active_weight += weight

    if active_weight >= 0.3:   # need at least 30% of weight to give a score
        composite = weighted_sum / active_weight   # 0–1
        delta     = round((composite - 0.5) * 2, 3)  # -1 to +1
    else:
        delta = None

    return {
        "delta":           delta,
        "components":      components,
        "guidance_count":  len(prev_guidance),
        "optimism_ratio":  round(opt / total, 3) if total > 0 else None,
        "active_weight":   round(active_weight, 2),
    }


# ── cumulative scoring ────────────────────────────────────────────────────────

RECENCY_DECAY = 0.78   # each older quarter is worth 78% of the next

RATING_BANDS = [
    (85, "Goldman Tier",    "Management is highly reliable. Guidance has strong institutional-grade predictive value."),
    (70, "Credible",        "Consistent track record with occasional miss. Guidance is trustworthy."),
    (55, "Mixed Signals",   "Guidance is partially predictive. Elevated analytical skepticism warranted."),
    (40, "Questionable",    "Frequent guidance misses. Treat forward statements with significant discount."),
    ( 0, "Smoke & Mirrors", "Management guidance has little to no predictive value. Rely on quantitative data only."),
]


def credibility_summary(history: list[dict]) -> dict:
    """
    Build a summary credibility profile from a list of per-quarter records.

    Each record needs: quarter, credibility_delta (dict or float),
    prev_quarter, prev_optimism_ratio, actual_sentiment_pos.
    """
    scored = [h for h in history if h.get("credibility_delta") is not None]
    n = len(scored)

    if n == 0:
        return {
            "score":             None,
            "rating":            "Insufficient Data",
            "description":       "Need at least 2 analysed quarters to compute credibility.",
            "trend":             None,
            "quarters_tracked":  0,
            "avg_delta":         None,
            "component_averages":None,
            "history":           history,
        }

    # Exponential recency-weighted average (most recent quarter = weight 1.0)
    total_weight   = 0.0
    weighted_delta = 0.0
    for i, record in enumerate(reversed(scored)):   # i=0 is most recent
        w = RECENCY_DECAY ** i
        delta = record.get("credibility_delta")
        # delta might be a raw float (legacy) or the new dict
        if isinstance(delta, dict):
            delta = delta.get("delta")
        if delta is not None:
            weighted_delta += delta * w
            total_weight   += w

    avg_delta = weighted_delta / total_weight if total_weight > 0 else 0
    raw_score = (avg_delta + 1) / 2 * 100     # -1..+1  →  0..100
    score     = max(0, min(100, round(raw_score)))

    # Rating band
    rating, description = "Insufficient Data", ""
    for threshold, label, desc in RATING_BANDS:
        if score >= threshold:
            rating, description = label, desc
            break

    # Trend: compare last two deltas
    if n >= 2:
        d_recent = scored[-1].get("credibility_delta")
        d_prior  = scored[-2].get("credibility_delta")
        if isinstance(d_recent, dict): d_recent = d_recent.get("delta")
        if isinstance(d_prior,  dict): d_prior  = d_prior.get("delta")
        if d_recent is not None and d_prior is not None:
            diff = d_recent - d_prior
            trend = "improving" if diff > 0.05 else "deteriorating" if diff < -0.05 else "stable"
        else:
            trend = "stable"
    else:
        trend = "insufficient data"

    # Average component scores across quarters (where available)
    comp_keys = ["tone_accuracy", "directional_accuracy", "specificity",
                 "risk_transparency", "financial_alignment"]
    comp_avgs: dict = {}
    for key in comp_keys:
        vals = []
        for record in scored:
            cd = record.get("credibility_delta")
            if isinstance(cd, dict):
                v = cd.get("components", {}).get(key)
                if v is not None:
                    vals.append(v)
        if vals:
            comp_avgs[key] = round(sum(vals) / len(vals), 3)

    return {
        "score":              score,
        "rating":             rating,
        "description":        description,
        "trend":              trend,
        "quarters_tracked":   n,
        "avg_delta":          round(avg_delta, 3),
        "component_averages": comp_avgs or None,
        "history":            history,
    }
