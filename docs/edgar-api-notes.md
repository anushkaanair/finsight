# EDGAR API Notes

Findings from building the SEC EDGAR ingestion layer.

## Rate Limits

SEC EDGAR enforces **10 requests/second** per IP for automated access.
We sleep 100–120 ms between calls to stay comfortably under the limit.

The `User-Agent` header **must** include a real email address or the request returns 403.

## CIK Resolution

Company tickers are mapped to CIKs via:
```
https://www.sec.gov/files/company_tickers.json
```
This file is ~2 MB and is cached module-level after the first fetch.

## Filing Lookup

Submissions are fetched per CIK:
```
https://data.sec.gov/submissions/CIK{cik}.json
```
The `filings.recent` object contains parallel arrays for `form`, `periodOfReport`, and `accessionNumber`.

## Quarter → Period Mapping

| Quarter | Form   | Period range      |
|---------|--------|-------------------|
| Q1      | 10-Q   | Jan 01 – Apr 30   |
| Q2      | 10-Q   | May 01 – Jul 31   |
| Q3      | 10-Q   | Aug 01 – Oct 31   |
| Q4      | 10-K   | Nov 01 – Jan 31+1 |

## Caching

Downloaded filings are stored at `data/{cik}/{quarter}/filing.html`.
Subsequent runs skip the download entirely.
