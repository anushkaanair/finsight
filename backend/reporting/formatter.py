"""Formatting helpers shared between CLI and PDF output."""
from datetime import datetime


def fmt_pct(value: float) -> str:
    """Format a 0-1 float as a percentage string."""
    return f"{value * 100:.1f}%"


def fmt_large_number(n: int | float | None) -> str:
    """Format a large number with B/M/K suffix."""
    if n is None:
        return "N/A"
    if n >= 1_000_000_000:
        return f"${n / 1_000_000_000:.2f}B"
    if n >= 1_000_000:
        return f"${n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"${n / 1_000:.1f}K"
    return f"${n:.2f}"


def fmt_datetime(iso_str: str) -> str:
    """Convert ISO datetime string to human-readable form."""
    try:
        dt = datetime.fromisoformat(iso_str)
        return dt.strftime("%b %d, %Y %H:%M UTC")
    except ValueError:
        return iso_str


def sentiment_emoji(label: str) -> str:
    return {"positive": "📈", "negative": "📉", "neutral": "➡️"}.get(label, "")
