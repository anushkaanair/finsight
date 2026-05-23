"""
FinSight — EDGAR Real-Data Seeder
==================================
Pulls live 10-Q / 10-K filings from SEC EDGAR for a set of tickers,
runs the full FinSight analysis pipeline on each quarter, and stores
everything in the local SQLite DB (including credibility tracking).

Usage:
  # from backend/ directory
  python scripts/seed_edgar_data.py

  # custom tickers / quarters
  python scripts/seed_edgar_data.py --tickers AAPL NVDA MSFT TSLA --quarters 4

  # dry-run (resolve + download only, no DB write)
  python scripts/seed_edgar_data.py --dry-run

Requires: backend/.env with GROQ_API_KEY for the analyst brief generation.
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
from datetime import datetime
from pathlib import Path

# ── path setup so imports work from scripts/ ──────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")

import io
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

# Force UTF-8 on Windows to avoid cp1252 encoding errors with Rich box characters
console = Console(highlight=False, emoji=False)

# ── configure logging (suppress noisy transformers / torch output) ────────────
logging.basicConfig(level=logging.WARNING)
for noisy in ("transformers", "torch", "sentence_transformers", "faiss"):
    logging.getLogger(noisy).setLevel(logging.ERROR)
logger = logging.getLogger("seeder")


# ── quarter arithmetic ────────────────────────────────────────────────────────

def _prev_quarter(q: str) -> str:
    label, year = q.split("-")
    year = int(year)
    order = ["Q1", "Q2", "Q3", "Q4"]
    idx = order.index(label.upper())
    return f"Q4-{year - 1}" if idx == 0 else f"{order[idx - 1]}-{year}"


def _recent_10q_quarters(n: int) -> list[str]:
    """
    Return the n most-recently-filed 10-Q quarters (Q1/Q2/Q3 only),
    working backwards from today.  We skip Q4 (10-K) because fiscal year
    end dates vary by company (AAPL ends in Sep, MSFT in Jun, etc.) which
    makes calendar-Q4 mapping unreliable without per-ticker logic.
    """
    now = datetime.utcnow()
    month, year = now.month, now.year

    # Most recent 10-Q that should be filed:
    #   Q1 (Jan-Mar period)  → 10-Q filed ~May       → available May+
    #   Q2 (Apr-Jun period)  → 10-Q filed ~Aug       → available Aug+
    #   Q3 (Jul-Sep period)  → 10-Q filed ~Nov       → available Nov+
    if month >= 11:
        latest = f"Q3-{year}"
    elif month >= 8:
        latest = f"Q2-{year}"
    elif month >= 5:
        latest = f"Q1-{year}"
    else:
        latest = f"Q3-{year - 1}"  # Jan-Apr: most recent 10-Q is prior year Q3

    quarters: list[str] = []
    q = latest
    while len(quarters) < n:
        label = q.split("-")[0].upper()
        if label != "Q4":          # skip Q4 (10-K) entirely
            quarters.append(q)
        q = _prev_quarter(q)

    return quarters  # most recent first


# ── main pipeline ─────────────────────────────────────────────────────────────

DEFAULT_TICKERS = ["AAPL", "NVDA", "MSFT", "TSLA"]
DEFAULT_QUARTERS = 4


def seed(tickers: list[str], n_quarters: int, dry_run: bool = False) -> None:
    # Late imports (heavy ML models) — only load after path setup
    from ingestion.edgar_client import get_cik, download_filing
    from ingestion.parser import extract_sections
    from analysis.sentiment import score_mda
    from analysis.risk_delta import compute_risk_delta
    from analysis.guidance import extract_guidance
    from analysis.financials import extract_financials
    from analysis.credibility import compute_credibility_delta, credibility_summary
    from rag.indexer import build_index, index_dir_for
    from chat.market import get_market_snapshot
    from chat.engine import generate_brief
    from db import (
        init_db, save_analysis, get_analysis,
        save_credibility, get_credibility,
        add_to_watchlist,
    )

    if not dry_run:
        init_db()

    quarters = _recent_10q_quarters(n_quarters)
    total_jobs = len(tickers) * len(quarters)

    console.print(Panel.fit(
        f"[bold cyan]FinSight EDGAR Seeder[/bold cyan]\n"
        f"Tickers : [yellow]{', '.join(tickers)}[/yellow]\n"
        f"Quarters: [yellow]{', '.join(reversed(quarters))}[/yellow]  "
        f"(most recent -> oldest)\n"
        f"Jobs    : [yellow]{total_jobs}[/yellow]   "
        f"Dry-run : [{'green' if dry_run else 'red'}]{dry_run}[/{'green' if dry_run else 'red'}]",
        border_style="cyan",
    ))

    results_table: list[dict] = []  # for end summary

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        TimeElapsedColumn(),
        console=console,
        transient=False,
    ) as progress:
        overall = progress.add_task("[cyan]Overall progress", total=total_jobs)

        for ticker in tickers:
            # Add to watchlist so portfolio endpoint shows it
            if not dry_run:
                add_to_watchlist(ticker)

            try:
                cik = get_cik(ticker)
            except Exception as e:
                console.print(f"[red]  ✗ {ticker}: CIK resolution failed — {e}[/red]")
                progress.advance(overall, len(quarters))
                for q in quarters:
                    results_table.append({
                        "ticker": ticker, "quarter": q,
                        "status": "CIK failed", "score": None, "cred": None,
                    })
                continue

            # Process quarters in chronological order so credibility is computed correctly
            for quarter in reversed(quarters):
                desc = f"[bold]{ticker}[/bold] {quarter}"
                task = progress.add_task(desc, total=None)

                row = {"ticker": ticker, "quarter": quarter, "status": "ok",
                       "score": None, "cred": None}

                try:
                    # ── 0. Cache check ──────────────────────────────────────
                    cached = get_analysis(ticker, quarter)
                    if cached:
                        progress.update(task, description=f"  {ticker} {quarter} -- cache hit")
                        row["score"] = cached.get("health_score")
                        row["status"] = "cached"
                        try:
                            progress.remove_task(task)
                        except Exception:
                            pass
                        progress.advance(overall)
                        results_table.append(row)
                        continue

                    # ── 1. Download filing ──────────────────────────────────
                    progress.update(task, description=f"  {desc} — downloading filing…")
                    filing_path = download_filing(cik, quarter)
                    html = Path(filing_path).read_text(encoding="utf-8", errors="replace")
                    time.sleep(0.15)  # be polite to SEC servers

                    if dry_run:
                        console.print(f"  [green]OK[/green] {ticker} {quarter} — "
                                      f"downloaded ({len(html)//1024} KB)")
                        row["status"] = "dry-run OK"
                        try:
                            progress.remove_task(task)
                        except Exception:
                            pass
                        progress.advance(overall)
                        results_table.append(row)
                        continue

                    # ── 2. Parse ────────────────────────────────────────────
                    progress.update(task, description=f"  {desc} — parsing sections…")
                    sections = extract_sections(html)
                    mda_text  = sections.get("mda", "")
                    risk_text = sections.get("risk_factors", "")

                    if not mda_text and not risk_text:
                        raise ValueError("MD&A and Risk Factors both empty after parse")

                    # ── 3. Sentiment ────────────────────────────────────────
                    progress.update(task, description=f"  {desc} — FinBERT sentiment…")
                    sentiment = (
                        score_mda(mda_text)
                        if mda_text
                        else {"label": "neutral", "score": {"positive": 0, "negative": 0, "neutral": 1}}
                    )

                    # ── 4. Risk delta ───────────────────────────────────────
                    progress.update(task, description=f"  {desc} — risk factor delta…")
                    prev_q = _prev_quarter(quarter)
                    risk_delta = {"added": [], "removed": [], "modified": []}
                    try:
                        prev_filing = download_filing(cik, prev_q)
                        prev_html   = Path(prev_filing).read_text(encoding="utf-8", errors="replace")
                        prev_secs   = extract_sections(prev_html)
                        prev_risk   = prev_secs.get("risk_factors", "")
                        if prev_risk and risk_text:
                            risk_delta = compute_risk_delta(prev_risk, risk_text)
                    except Exception as e:
                        logger.debug("Risk delta skipped for %s %s: %s", ticker, quarter, e)

                    # ── 5. Guidance ─────────────────────────────────────────
                    progress.update(task, description=f"  {desc} — extracting guidance…")
                    guidance   = extract_guidance(mda_text) if mda_text else []
                    financials = extract_financials(html)

                    # ── 6. FAISS index ──────────────────────────────────────
                    progress.update(task, description=f"  {desc} — building RAG index…")
                    corpus  = "\n\n".join(filter(None, [mda_text, risk_text]))
                    idx_dir = index_dir_for(ticker, quarter)
                    try:
                        build_index(corpus, idx_dir)
                    except Exception as e:
                        logger.debug("FAISS build skipped for %s %s: %s", ticker, quarter, e)

                    # ── 7. Market snapshot ──────────────────────────────────
                    market = {}
                    try:
                        market = get_market_snapshot(ticker)
                    except Exception:
                        pass

                    # ── 8. Groq brief ───────────────────────────────────────
                    progress.update(task, description=f"  {desc} — generating Groq brief…")
                    brief = generate_brief(
                        ticker=ticker, quarter=quarter,
                        sentiment=sentiment, guidance=guidance,
                        risk_delta=risk_delta, financials=financials,
                        mda_snippet=mda_text[:1500] if mda_text else "",
                    )

                    # ── 9. Health score ─────────────────────────────────────
                    opt_g  = sum(1 for g in guidance if g.get("tag") == "optimistic")
                    caut_g = sum(1 for g in guidance if g.get("tag") == "cautious")
                    tot_g  = opt_g + caut_g
                    sentiment_pts = round(sentiment.get("score", {}).get("positive", 0) * 40)
                    guidance_pts  = round((opt_g / tot_g) * 30) if tot_g > 0 else 15
                    risk_pts      = max(0, min(20, 20 - len(risk_delta.get("added", [])) * 4
                                               + len(risk_delta.get("removed", [])) * 2))
                    fin_keys      = {"revenue", "eps_diluted", "gross_profit", "net_income"}
                    present       = sum(1 for k in fin_keys if financials.get(k))
                    fin_pts       = 10 if present >= 3 else 5 if present >= 1 else 0
                    health_score  = max(0, min(100, sentiment_pts + guidance_pts + risk_pts + fin_pts))

                    # ── 10. Credibility delta ───────────────────────────────
                    progress.update(task, description=f"  {desc} — credibility delta…")
                    cred_delta = None
                    prev_opt_ratio = None
                    try:
                        prev_result = get_analysis(ticker, prev_q)
                        if prev_result:
                            prev_guid = prev_result.get("guidance", [])
                            o = sum(1 for g in prev_guid if g.get("tag") == "optimistic")
                            c = sum(1 for g in prev_guid if g.get("tag") == "cautious")
                            tot = o + c
                            if tot > 0:
                                prev_opt_ratio = round(o / tot, 3)
                            prev_sent = prev_result.get("sentiment")
                            prev_fin  = prev_result.get("financials")
                            prev_rd   = prev_result.get("risk_delta")
                            cred_delta = compute_credibility_delta(
                                prev_guidance=prev_guid,
                                curr_sentiment=sentiment,
                                prev_sentiment=prev_sent,
                                curr_financials=financials,
                                prev_financials=prev_fin,
                                curr_risk_delta=risk_delta,
                                prev_risk_delta=prev_rd,
                            )
                            # save_credibility expects a plain float, not the dict
                            cred_delta_float = (
                                cred_delta.get("delta")
                                if isinstance(cred_delta, dict)
                                else cred_delta
                            )
                            save_credibility(
                                ticker=ticker, quarter=quarter,
                                prev_quarter=prev_q,
                                prev_optimism_ratio=prev_opt_ratio,
                                actual_sentiment_pos=round(
                                    sentiment["score"].get("positive", 0), 3
                                ),
                                credibility_delta=cred_delta_float,
                            )
                    except Exception as e:
                        logger.debug("Credibility skipped for %s %s: %s", ticker, quarter, e)

                    # ── 11. Persist ─────────────────────────────────────────
                    result = {
                        "ticker":            ticker.upper(),
                        "quarter":           quarter,
                        "generated_at":      datetime.utcnow().isoformat(),
                        "sentiment":         sentiment,
                        "guidance":          guidance,
                        "risk_delta":        risk_delta,
                        "financials":        financials,
                        "market":            market,
                        "brief":             brief,
                        "health_score":      health_score,
                        "credibility_delta": cred_delta,
                    }
                    save_analysis(result)

                    row["score"] = health_score
                    row["cred"]  = (
                        cred_delta.get("delta") if isinstance(cred_delta, dict)
                        else cred_delta
                    )

                    progress.update(
                        task,
                        description=f"  [green]OK[/green] {desc} — "
                                    f"health={health_score}  "
                                    f"cred_delta={row['cred']}",
                    )

                except Exception as e:
                    row["status"] = f"FAILED: {e}"
                    progress.update(
                        task,
                        description=f"  [red]FAIL[/red] {desc} — {e}",
                    )
                    logger.exception("Failed %s %s", ticker, quarter)

                # Always clean up the sub-task and advance overall
                try:
                    progress.remove_task(task)
                except Exception:
                    pass
                progress.advance(overall)
                results_table.append(row)
                time.sleep(0.1)  # be polite to SEC servers

    # ── credibility summary per ticker ────────────────────────────────────────
    if not dry_run:
        from db import get_credibility
        from analysis.credibility import credibility_summary

        console.print()
        console.rule("[bold cyan]Credibility Summary[/bold cyan]")
        for ticker in tickers:
            hist = get_credibility(ticker)
            summ = credibility_summary(hist)
            rating  = summ.get("rating", "Insufficient Data")
            score   = summ.get("score")
            trend   = summ.get("trend", "—")
            tracked = summ.get("quarters_tracked", 0)
            color = (
                "green"  if score and score >= 70 else
                "yellow" if score and score >= 55 else
                "red"    if score else "dim"
            )
            console.print(
                f"  [bold]{ticker:6}[/bold]  "
                f"score=[{color}]{score if score is not None else 'N/A':>3}[/{color}]  "
                f"rating=[bold]{rating}[/bold]  "
                f"trend={trend}  "
                f"quarters={tracked}"
            )

    # ── results table ─────────────────────────────────────────────────────────
    console.print()
    table = Table(title="Seeding Results", border_style="cyan", show_lines=True)
    table.add_column("Ticker", style="bold")
    table.add_column("Quarter")
    table.add_column("Status")
    table.add_column("Health", justify="right")
    table.add_column("Cred Δ", justify="right")

    for row in results_table:
        status_color = (
            "green"  if row["status"] in ("ok", "cached", "dry-run OK") else "red"
        )
        score_str = str(row["score"]) if row["score"] is not None else "—"
        cred_str  = f"{row['cred']:+.3f}" if row["cred"] is not None else "—"
        table.add_row(
            row["ticker"],
            row["quarter"],
            f"[{status_color}]{row['status']}[/{status_color}]",
            score_str,
            cred_str,
        )

    console.print(table)
    success = sum(1 for r in results_table if r["status"] in ("ok", "cached"))
    console.print(f"\n[bold]Done.[/bold] {success}/{len(results_table)} analyses stored.\n")


# ── CLI ───────────────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Seed FinSight DB with real EDGAR 10-Q/10-K filings",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument(
        "--tickers", nargs="+", default=DEFAULT_TICKERS, metavar="TICKER",
        help=f"Ticker symbols to seed (default: {' '.join(DEFAULT_TICKERS)})",
    )
    p.add_argument(
        "--quarters", type=int, default=DEFAULT_QUARTERS, metavar="N",
        help=f"How many recent quarters to pull per ticker (default: {DEFAULT_QUARTERS})",
    )
    p.add_argument(
        "--dry-run", action="store_true",
        help="Download filings but skip analysis + DB writes",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    seed(
        tickers=[t.upper() for t in args.tickers],
        n_quarters=args.quarters,
        dry_run=args.dry_run,
    )
