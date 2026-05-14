import logging
import time
import requests
from pathlib import Path

logger = logging.getLogger(__name__)

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

_ticker_cache: dict = {}


def get_cik(ticker: str) -> str:
    global _ticker_cache
    if not _ticker_cache:
        logger.debug("fetching company tickers from SEC")
        resp = requests.get(TICKERS_URL, headers=HEADERS)
        resp.raise_for_status()
        _ticker_cache = resp.json()

    ticker_upper = ticker.upper()
    for entry in _ticker_cache.values():
        if entry["ticker"].upper() == ticker_upper:
            cik = str(entry["cik_str"]).zfill(10)
            logger.debug("resolved %s -> CIK %s", ticker_upper, cik)
            return cik
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

    # SEC EDGAR API changed field name: "periodOfReport" → "reportDate"
    period_key = "reportDate" if "reportDate" in recent else "periodOfReport"

    for i, form in enumerate(recent["form"]):
        if form != form_type:
            continue
        period = recent[period_key][i]
        if not period:
            continue
        if start <= period <= end:
            return {
                "accession": recent["accessionNumber"][i],
                "primary_doc": recent["primaryDocument"][i],
                "period": period,
                "form": form,
            }

    # Fallback: also check filingDate if reportDate didn't match
    for i, form in enumerate(recent["form"]):
        if form != form_type:
            continue
        filing_date = recent.get("filingDate", [""] * len(recent["form"]))[i] or ""
        if start <= filing_date <= end:
            return {
                "accession": recent["accessionNumber"][i],
                "primary_doc": recent["primaryDocument"][i],
                "period": filing_date,
                "form": form,
            }

    raise ValueError(f"No {form_type} found for CIK {cik} in {quarter_str}")


def download_filing(cik: str, quarter_str: str) -> str:
    cache_path = CACHE_DIR / cik / quarter_str / "filing.html"
    if cache_path.exists():
        logger.debug("cache hit: %s", cache_path)
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
    logger.info("saved filing to %s", cache_path)
    return str(cache_path)
