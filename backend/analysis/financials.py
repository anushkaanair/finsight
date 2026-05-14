"""
Financial table extractor for SEC 10-K / 10-Q filings.
Parses HTML tables to extract:
  - Revenue / Net Sales
  - Net Income
  - EPS (basic + diluted)
  - Gross Profit / Gross Margin
  - Operating Income / Operating Margin
  - R&D Expense
  - Total Assets / Liabilities
"""
from __future__ import annotations
import re
import logging
from bs4 import BeautifulSoup, Tag

logger = logging.getLogger(__name__)

# ── keyword maps ─────────────────────────────────────────────────────────────
REVENUE_KW    = re.compile(r"\b(net\s+(?:sales|revenue)|total\s+(?:net\s+)?(?:sales|revenue)|revenues?)\b", re.I)
NET_INCOME_KW = re.compile(r"\bnet\s+(?:income|earnings|loss)\b", re.I)
EPS_BASIC_KW  = re.compile(r"\bearnings?\s+per\s+(?:common\s+)?share[^,—–\n]*basic\b", re.I)
EPS_DIL_KW    = re.compile(r"\bearnings?\s+per\s+(?:common\s+)?share[^,—–\n]*diluted\b", re.I)
GROSS_KW      = re.compile(r"\bgross\s+(?:profit|margin)\b", re.I)
OP_INCOME_KW  = re.compile(r"\boperating\s+(?:income|loss|earnings)\b", re.I)
RD_KW         = re.compile(r"\bresearch\s+and\s+development\b", re.I)
ASSETS_KW     = re.compile(r"\btotal\s+assets\b", re.I)


def _clean_num(raw: str) -> str | None:
    """Strip formatting, return string like '94,929' or '1.52' or None."""
    s = raw.strip().replace(",", "").replace("$", "").replace("(", "-").replace(")", "")
    s = re.sub(r"\s+", "", s)
    if re.match(r"^-?\d+(\.\d+)?$", s):
        return s
    return None


def _fmt(val: str | None, billions: bool = False) -> str | None:
    if val is None:
        return None
    try:
        f = float(val)
        if billions:
            if abs(f) >= 1_000_000:
                return f"${f/1_000_000:.1f}B"
            if abs(f) >= 1_000:
                return f"${f/1_000:.1f}M"
            return f"${f:.1f}M"
        return val
    except ValueError:
        return val


def _search_tables(soup: BeautifulSoup) -> dict:
    """
    Walk every <table> in the filing. For each row, check if the first
    cell matches a keyword; if so, grab the first numeric cell as the value.
    Returns a raw dict of label→value strings.
    """
    found: dict[str, str] = {}

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all(["td", "th"])
            if len(cells) < 2:
                continue

            label_text = cells[0].get_text(separator=" ", strip=True)

            # find first numeric value cell
            num_val: str | None = None
            for cell in cells[1:]:
                raw = cell.get_text(separator=" ", strip=True)
                cleaned = _clean_num(raw)
                if cleaned:
                    num_val = cleaned
                    break

            if num_val is None:
                continue

            if REVENUE_KW.search(label_text) and "revenue" not in found:
                found["revenue"] = num_val
            if NET_INCOME_KW.search(label_text) and "net_income" not in found:
                found["net_income"] = num_val
            if EPS_BASIC_KW.search(label_text) and "eps_basic" not in found:
                found["eps_basic"] = num_val
            if EPS_DIL_KW.search(label_text) and "eps_diluted" not in found:
                found["eps_diluted"] = num_val
            if GROSS_KW.search(label_text) and "gross_profit" not in found:
                found["gross_profit"] = num_val
            if OP_INCOME_KW.search(label_text) and "operating_income" not in found:
                found["operating_income"] = num_val
            if RD_KW.search(label_text) and "rd_expense" not in found:
                found["rd_expense"] = num_val
            if ASSETS_KW.search(label_text) and "total_assets" not in found:
                found["total_assets"] = num_val

    return found


def _compute_margins(raw: dict) -> dict:
    """Derive margin ratios if we have both numerator and revenue."""
    margins: dict[str, str | None] = {}
    try:
        rev = float(raw.get("revenue", "") or "0")
        if rev == 0:
            return margins
        if "gross_profit" in raw:
            gp = float(raw["gross_profit"])
            margins["gross_margin"] = f"{gp/rev*100:.1f}%"
        if "operating_income" in raw:
            oi = float(raw["operating_income"])
            margins["operating_margin"] = f"{oi/rev*100:.1f}%"
        if "net_income" in raw:
            ni = float(raw["net_income"])
            margins["net_margin"] = f"{ni/rev*100:.1f}%"
    except (ValueError, ZeroDivisionError):
        pass
    return margins


def extract_financials(html: str) -> dict:
    """
    Main entry point. Returns a structured dict with formatted values
    suitable for direct display in the frontend.
    """
    try:
        soup = BeautifulSoup(html, "lxml")
        raw = _search_tables(soup)

        if not raw:
            logger.warning("No financial tables extracted from filing")
            return {"available": False}

        margins = _compute_margins(raw)

        # Determine scale: SEC filings report in thousands or millions
        # Heuristic: revenue > 100,000 → likely in thousands
        billions = False
        try:
            rev_raw = float(raw.get("revenue", "0") or "0")
            billions = rev_raw >= 1_000  # treat as thousands → convert
        except ValueError:
            pass

        result = {
            "available": True,
            "revenue":          _fmt(raw.get("revenue"), billions=billions),
            "net_income":       _fmt(raw.get("net_income"), billions=billions),
            "gross_profit":     _fmt(raw.get("gross_profit"), billions=billions),
            "operating_income": _fmt(raw.get("operating_income"), billions=billions),
            "rd_expense":       _fmt(raw.get("rd_expense"), billions=billions),
            "total_assets":     _fmt(raw.get("total_assets"), billions=billions),
            "eps_basic":        raw.get("eps_basic"),
            "eps_diluted":      raw.get("eps_diluted"),
            **margins,
        }

        # Strip None values
        return {k: v for k, v in result.items() if v is not None}

    except Exception as e:
        logger.error("Financial extraction failed: %s", e)
        return {"available": False, "error": str(e)}
