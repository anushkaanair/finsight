"""Plain-text brief templates used by both CLI and PDF output."""

BRIEF_HEADER = """
╔══════════════════════════════════════════════════════════╗
║              FinSight — Equity Research Brief            ║
╚══════════════════════════════════════════════════════════╝
Ticker  : {ticker}
Quarter : {quarter}
Generated: {generated_at}
"""

SENTIMENT_SECTION = """
── SENTIMENT ──────────────────────────────────────────────
Label    : {label}
Positive : {positive}
Negative : {negative}
Neutral  : {neutral}
Trend    : {trend}
"""

GUIDANCE_SECTION_HEADER = """
── FORWARD GUIDANCE ({count} signals) ─────────────────────
"""

GUIDANCE_ITEM = "  [{tag}] {text}\n"

RISK_DELTA_SECTION = """
── RISK FACTOR DELTA ──────────────────────────────────────
Added    : {added}
Removed  : {removed}
Modified : {modified}
"""

RISK_ADDED_ITEM   = "  + {text}\n"
RISK_REMOVED_ITEM = "  - {text}\n"
