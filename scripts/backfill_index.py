#!/usr/bin/env python3
"""
Backfill FAISS indexes for multiple tickers / quarters in one shot.

Usage:
    python scripts/backfill_index.py --tickers AAPL MSFT NVDA \
        --quarters Q1-2024 Q2-2024 Q3-2024 Q4-2024
"""
import sys
from pathlib import Path
import click

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from ingestion.edgar_client import get_cik, download_filing
from ingestion.parser import extract_sections
from rag.indexer import build_index


@click.command()
@click.option("--tickers", "-t", multiple=True, required=True)
@click.option("--quarters", "-q", multiple=True, required=True)
def backfill(tickers, quarters):
    """Download filings and build FAISS indexes for each ticker/quarter pair."""
    total = len(tickers) * len(quarters)
    done = 0
    for ticker in tickers:
        try:
            cik = get_cik(ticker)
        except ValueError as e:
            click.echo(f"[skip] {e}", err=True)
            continue
        for quarter in quarters:
            done += 1
            click.echo(f"[{done}/{total}] {ticker} {quarter}")
            try:
                path = download_filing(cik, quarter)
                html = Path(path).read_text(encoding="utf-8")
                sections = extract_sections(html)
                text = " ".join(sections.values())
                build_index(text, str(Path(path).parent))
                click.echo(f"  ✓ index built")
            except Exception as e:
                click.echo(f"  ✗ {e}", err=True)


if __name__ == "__main__":
    backfill()
