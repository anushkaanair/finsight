"""
Groq-powered chat engine — uses llama-3.3-70b-versatile (free tier, ~100k tokens/min).
Falls back gracefully if GROQ_API_KEY is missing.
"""
from __future__ import annotations
import os
import logging

logger = logging.getLogger(__name__)

GROQ_MODEL = "llama-3.3-70b-versatile"

ANALYST_SYSTEM_PROMPT = """You are a senior equity research analyst with deep expertise in SEC filings, \
financial statement analysis, and investment risk assessment. You have 15 years of experience \
at a top-tier investment bank analysing 10-K and 10-Q filings.

When answering questions:
- Be precise and cite specific numbers or phrases from the filing context
- Structure your answer clearly (use bullet points for lists)
- Highlight material changes or red flags
- Keep answers concise but complete (3-6 sentences typically)
- If the context doesn't contain enough information, say so clearly"""

BRIEF_SYSTEM_PROMPT = """You are a senior equity research analyst writing a concise analyst brief \
for an institutional client. Write in the style of a Goldman Sachs or Morgan Stanley research note: \
authoritative, precise, and data-driven. 3-4 sentences maximum. Do not use bullet points. \
Lead with the most material finding."""

# Keep backward-compat alias
SYSTEM_PROMPT = ANALYST_SYSTEM_PROMPT


def generate_brief(
    ticker: str,
    quarter: str,
    sentiment: dict,
    guidance: list,
    risk_delta: dict,
    financials: dict,
    mda_snippet: str = "",
) -> str:
    """
    Use Groq to write a professional analyst brief from structured filing metrics.
    Falls back to a template string if Groq is unavailable.
    """
    pos = sentiment["score"].get("positive", 0)
    neg = sentiment["score"].get("negative", 0)
    neu = sentiment["score"].get("neutral", 0)
    lbl = sentiment.get("label", "neutral")
    opt_count = sum(1 for g in guidance if g.get("tag") == "optimistic")
    caut_count = sum(1 for g in guidance if g.get("tag") == "cautious")
    new_risks = len(risk_delta.get("added", []))
    removed_risks = len(risk_delta.get("removed", []))

    # Build a structured prompt with all the quantitative signals
    metrics_block = (
        f"Ticker: {ticker.upper()} | Quarter: {quarter}\n"
        f"FinBERT MD&A Sentiment: {lbl} — {pos*100:.0f}% positive, "
        f"{neg*100:.0f}% negative, {neu*100:.0f}% neutral\n"
        f"Forward Guidance: {len(guidance)} signals detected "
        f"({opt_count} optimistic, {caut_count} cautious)\n"
        f"Risk Factor Delta vs prior quarter: {new_risks} new risks added, "
        f"{removed_risks} removed\n"
    )
    if financials.get("revenue"):
        metrics_block += f"Revenue: {financials['revenue']}\n"
    if financials.get("eps_diluted"):
        metrics_block += f"EPS (diluted): ${financials['eps_diluted']}\n"
    if financials.get("gross_margin"):
        metrics_block += f"Gross Margin: {financials['gross_margin']}\n"
    if mda_snippet:
        metrics_block += f"\nMD&A excerpt (first 1500 chars):\n{mda_snippet[:1500]}"

    try:
        from groq import Groq  # type: ignore
        api_key = os.environ.get("GROQ_API_KEY", "")
        if not api_key:
            raise ValueError("No GROQ_API_KEY")

        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": BRIEF_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Write a concise analyst brief for this filing:\n\n{metrics_block}"
                    ),
                },
            ],
            max_tokens=300,
            temperature=0.2,
        )
        brief = completion.choices[0].message.content.strip()
        logger.info("Groq generated brief for %s %s (%d chars)", ticker, quarter, len(brief))
        return brief

    except Exception as e:
        logger.warning("Groq brief generation failed (%s) — using template fallback", e)
        # Template fallback (same as before, but only used when Groq is unavailable)
        brief = (
            f"{ticker.upper()} {quarter} filing analysis: FinBERT scores the MD&A as "
            f"{lbl} ({pos*100:.0f}% positive / {neg*100:.0f}% negative). "
            f"{len(guidance)} forward guidance signals detected "
            f"({opt_count} optimistic, {caut_count} cautious). "
            f"Risk factor delta: {new_risks} new risks added, "
            f"{removed_risks} removed vs prior quarter."
        )
        if financials.get("revenue"):
            brief += f" Revenue: {financials['revenue']}."
        if financials.get("eps_diluted"):
            brief += f" EPS (diluted): ${financials['eps_diluted']}."
        return brief


def _groq_answer(query: str, context: str) -> str:
    """Call Groq API. Returns answer string."""
    try:
        from groq import Groq  # type: ignore
    except ImportError:
        return _fallback_answer(query, context)

    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return _fallback_answer(query, context)

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": ANALYST_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"SEC Filing Context:\n{context[:6000]}\n\n"
                        f"Analyst Question: {query}"
                    ),
                },
            ],
            max_tokens=600,
            temperature=0.1,
        )
        return completion.choices[0].message.content
    except Exception as e:
        logger.warning("Groq API error: %s — using fallback", e)
        return _fallback_answer(query, context)


def _fallback_answer(query: str, context: str) -> str:
    """Simple keyword extraction fallback when Groq is unavailable."""
    sentences = [s.strip() for s in context.replace("\n", " ").split(".") if s.strip()]
    q_words = set(query.lower().split())
    scored = []
    for s in sentences:
        score = sum(1 for w in q_words if w in s.lower())
        if score > 0:
            scored.append((score, s))
    scored.sort(reverse=True)
    top = [s for _, s in scored[:3]]
    if top:
        return ". ".join(top) + "."
    return (
        "I couldn't find a direct answer in the filing context. "
        "Please ensure you've run an analysis first and try rephrasing your question."
    )


def answer_question(query: str, context: str, sources: list | None = None) -> dict:
    if not context.strip():
        return {
            "answer": (
                "No filing data loaded. Run an analysis on a ticker first, "
                "then I can answer questions about it."
            ),
            "sources": [],
        }
    answer = _groq_answer(query, context)
    return {"answer": answer, "sources": sources or []}
