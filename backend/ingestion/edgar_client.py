import time
import requests
from pathlib import Path

HEADERS = {"User-Agent": "FinSight research@finsight.local"}
TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
FILING_URL = "https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{doc}"
CACHE_DIR = Path(__file__).parent.parent / "data"

QUARTER_MAP = {
    "Q1": ("01-01", "04-30", "10-Q"),
    "Q2": ("05-01", "07-31", "10-Q"),
    "Q3": ("08-01", "10-31", "10-Q"),
    "Q4": ("11-01", "01-31", "10-K"),
}


def get_cik(ticker: str) -> str:
    resp = requests.get(TICKERS_URL, headers=HEADERS)
    resp.raise_for_status()
    ticker_upper = ticker.upper()
    for entry in resp.json().values():
        if entry["ticker"].upper() == ticker_upper:
            return str(entry["cik_str"]).zfill(10)
    raise ValueError(f"Ticker '{ticker}' not found on SEC EDGAR")


def map_quarter_to_period(quarter_str: str) -> tuple:
    q, year = quarter_str.split("-")
    year = int(year)
    q_start, q_end, form = QUARTER_MAP[q.upper()]
    start = f"{year}-{q_start}"
    end = f"{year + 1}-{q_end}" if q.upper() == "Q4" else f"{year}-{q_end}"
    return start, end, form


def get_filing_for_quarter(cik: str, quarter_str: str) -> dict:
    start, end, form_type = map_quarter_to_period(quarter_str)
    resp = requests.get(SUBMISSIONS_URL.format(cik=cik), headers=HEADERS)
    resp.raise_for_status()
    time.sleep(0.1)

    recent = resp.json()["filings"]["recent"]
    for i, form in enumerate(recent["form"]):
        if form != form_type:
            continue
        period = recent["periodOfReport"][i]
        if start <= period <= end:
            return {
                "accession": recent["accessionNumber"][i],
                "primary_doc": recent["primaryDocument"][i],
                "period": period,
                "form": form,
            }
    raise ValueError(f"No {form_type} found for CIK {cik} in {quarter_str}")


def download_filing(cik: str, quarter_str: str) -> str:
    cache_path = CACHE_DIR / cik / quarter_str / "filing.html"
    if cache_path.exists():
        return str(cache_path)

    filing = get_filing_for_quarter(cik, quarter_str)
    accession_clean = filing["accession"].replace("-", "")
    url = FILING_URL.format(
        cik=int(cik), accession=accession_clean, doc=filing["primary_doc"]
    )
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    time.sleep(0.1)

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(resp.text, encoding="utf-8")
    return str(cache_path)
