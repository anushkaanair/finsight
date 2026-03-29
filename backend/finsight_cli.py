import sys
from pathlib import Path
import click
from rich.console import Console

from ingestion.edgar_client import get_cik, download_filing
from ingestion.parser import extract_sections
from analysis.sentiment import score_mda
from analysis.risk_delta import compute_risk_delta
from analysis.guidance import extract_guidance
from rag.indexer import build_index
from rag.retriever import retrieve
from reporting.brief import assemble_brief
from reporting.cli_output import print_brief
from reporting.pdf_export import export_pdf

console = Console()


@click.command()
@click.option("--ticker", required=True, help="Stock ticker e.g. AAPL")
@click.option("--quarter", default=None, help="Single quarter e.g. Q3-2024")
@click.option("--quarters", multiple=True, help="Two quarters for QoQ")
@click.option("--query", default="What changed this quarter versus last?")
@click.option("--no-pdf", is_flag=True, default=False)
def main(ticker, quarter, quarters, query, no_pdf):
    """FinSight — automated SEC filing analyst."""
    if quarter and not quarters:
        quarters = (quarter,)
    if not quarters:
        console.print("[red]Provide --quarter or --quarters[/red]")
        sys.exit(1)

    cik = get_cik(ticker)
    console.print(f"[cyan]{ticker} → CIK {cik}[/cyan]")

    sections_by_quarter = {}
    index_dirs = {}

    for q in quarters:
        console.print(f"[cyan]Fetching {q}...[/cyan]")
        filing_path = download_filing(cik, q)
        html = Path(filing_path).read_text(encoding="utf-8")
        sections = extract_sections(html)
        sections_by_quarter[q] = sections

        full_text = " ".join(sections.values())
        index_dir = str(Path(filing_path).parent)
        build_index(full_text, index_dir)
        index_dirs[q] = index_dir

    primary = quarters[0]
    primary_sections = sections_by_quarter[primary]

    sentiment = score_mda(primary_sections.get("mda", ""))
    guidance = extract_guidance(primary_sections.get("mda", ""))

    if len(quarters) >= 2:
        prior_sections = sections_by_quarter[quarters[1]]
        risk_delta = compute_risk_delta(
            prior_sections.get("risk_factors", ""),
            primary_sections.get("risk_factors", ""),
        )
        prior_sentiment = score_mda(prior_sections.get("mda", ""))
        rag_results = retrieve(query, index_dirs)
    else:
        risk_delta = {"added": [], "removed": [], "modified": []}
        prior_sentiment = None
        rag_results = retrieve(query, {primary: index_dirs[primary]})

    brief = assemble_brief(
        ticker=ticker,
        quarter=primary,
        sentiment=sentiment,
        guidance=guidance,
        risk_delta=risk_delta,
        rag_results=rag_results,
        prior_sentiment=prior_sentiment,
    )

    print_brief(brief)

    if not no_pdf:
        pdf_path = export_pdf(brief)
        console.print(f"[green]PDF saved: {pdf_path}[/green]")


if __name__ == "__main__":
    main()
