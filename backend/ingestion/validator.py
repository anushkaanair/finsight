"""Validation helpers for ticker symbols and quarter strings."""
import re

QUARTER_RE = re.compile(r"^Q[1-4]-\d{4}$", re.IGNORECASE)
TICKER_RE  = re.compile(r"^[A-Z]{1,5}$")


def validate_ticker(ticker: str) -> str:
    """Normalise and validate a ticker symbol."""
    t = ticker.strip().upper()
    if not TICKER_RE.match(t):
        raise ValueError(f"Invalid ticker: {ticker!r}. Expected 1-5 uppercase letters.")
    return t


def validate_quarter(quarter: str) -> str:
    """Validate a quarter string like Q3-2024."""
    q = quarter.strip().upper()
    if not QUARTER_RE.match(q):
        raise ValueError(
            f"Invalid quarter: {quarter!r}. Expected format Q1-2024 through Q4-2025."
        )
    return q
