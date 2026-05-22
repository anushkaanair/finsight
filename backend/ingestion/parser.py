import re
import logging
import warnings
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

logger = logging.getLogger(__name__)

# Suppress the noisy BS4 warning about parsing iXBRL (XML) files with the
# HTML parser — we do this intentionally; lxml handles both well.
warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)


# ── normalisation helper ──────────────────────────────────────────────────────
# Modern SEC filings use inline XBRL (iXBRL).  After BS4 extraction they can
# contain \xa0 (non-breaking space), smart apostrophes (' / �), and
# other Unicode oddities.  Normalise before running regex patterns.

def _normalise(text: str) -> str:
    """Collapse whitespace variants and fix smart quotes for regex matching."""
    # Non-breaking space (U+00A0), zero-width space (U+200B), soft-hyphen (U+00AD) → space
    text = re.sub(r"[ ​­   ]+", " ", text)
    # Curly/smart apostrophes (U+2018 ' U+2019 ' U+201A ‚ U+201B ‛)
    # and garbled replacement char (U+FFFD) → straight ASCII apostrophe
    text = re.sub(r"[‘’‚‛�`]+", "'", text)
    # Collapse runs of spaces
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


# ── section patterns ──────────────────────────────────────────────────────────
# Cover both 10-Q and 10-K layouts:
#   10-Q: Item 1  = Financial Statements
#         Item 2  = MD&A
#         Item 1A (Part II) = Risk Factors
#   10-K: Item 1A = Risk Factors
#         Item 7  = MD&A
#         Item 8  = Financial Statements
#
# These patterns are tested against a 3-paragraph sliding window so that
# iXBRL filings where section titles are split across consecutive lines
# (e.g. "ITEM 1A. RI" + "SK FACTORS") are handled correctly.

SECTION_PATTERNS: dict[str, re.Pattern] = {
    "risk_factors": re.compile(
        r"item\s*1a[\.\s:]*risk\s*factor", re.IGNORECASE
    ),
    "mda": re.compile(
        r"item\s*(?:2|7)[\.\s:]*management(?:'s)?\s+(?:discussion|analysis)",
        re.IGNORECASE,
    ),
    "financials": re.compile(
        r"item\s*(?:1|8)[\.\s:]*financial\s*statement", re.IGNORECASE
    ),
}

# How many paragraphs to include when no closing boundary is found
_MAX_SECTION_PARAS = 400

# Minimum total characters the 50 paragraphs *after* a candidate heading must
# contain for it to be treated as a real section rather than a TOC entry.
# Empirically:
#   AAPL TOC entry → ≤ 838 chars   |  AAPL real section → ≥ 1,475 chars
#   MSFT cover page → ≤ 270 chars  |  MSFT real section → ≥ 6,486 chars
_MIN_FOLLOWING_CHARS = 1000

# A paragraph that references multiple "Item X" sections is a table-of-contents
# page — skip it even if the content-after check would pass.
_MULTI_ITEM_RE = re.compile(r"\bitem\s*\d", re.IGNORECASE)


def _has_content_after(paragraphs: list[str], idx: int) -> bool:
    """Return True if there is substantive prose in the next 50 paragraphs."""
    snippet = " ".join(paragraphs[idx + 1 : idx + 51])
    return len(snippet.strip()) >= _MIN_FOLLOWING_CHARS


def _is_toc_paragraph(text: str) -> bool:
    """True if paragraph is a table-of-contents page (contains 2+ item refs)."""
    return len(_MULTI_ITEM_RE.findall(text)) >= 2


_ITEM_RE = re.compile(r"\bitem\b", re.IGNORECASE)


def _candidates_for(paragraphs: list[str], i: int) -> list[str]:
    """
    Return the candidate strings to test the section pattern against.

    We test three variants to handle both normal and iXBRL line-split filings:
      1. The current paragraph alone
      2. Current + next paragraph joined with a space   (separate-line headings)
      3. Current + next paragraph joined without space  (mid-word line breaks)

    Crucially, variants 2 and 3 are ONLY generated when the current paragraph
    itself contains the word "item" — otherwise the window would pull in a
    neighbouring TOC paragraph and produce false positives.
    """
    cur = _normalise(paragraphs[i])
    if i + 1 < len(paragraphs) and _ITEM_RE.search(cur):
        nxt = _normalise(paragraphs[i + 1])
        return [cur, f"{cur} {nxt}", f"{cur}{nxt}"]
    return [cur]


def extract_sections(html: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    paragraphs = [
        p.get_text(separator=" ", strip=True)
        for p in soup.find_all(["p", "div", "span", "td"])
    ]

    # ── find the first *substantive* occurrence of each section heading ──────
    # We skip TOC / sidebar entries that match the pattern but have no real
    # content following them.  We also skip empty/whitespace-only paragraphs
    # so that a window-match from the *next* paragraph cannot set a boundary.
    boundaries: dict[str, int] = {}
    for i in range(len(paragraphs)):
        if len(boundaries) == len(SECTION_PATTERNS):
            break  # all sections found — no need to scan further
        # Skip empty paragraphs — they can't be section headings.
        para = paragraphs[i]
        if len(para.strip()) < 4:
            continue
        # Skip table-of-contents pages (contain multiple "Item X" refs).
        if _is_toc_paragraph(para):
            continue
        candidates = _candidates_for(paragraphs, i)
        for name, pattern in SECTION_PATTERNS.items():
            if name in boundaries:
                continue
            if any(pattern.search(c) for c in candidates):
                if _has_content_after(paragraphs, i):
                    boundaries[name] = i

    if not boundaries:
        logger.warning("No known sections found in filing HTML")
        return {}

    # ── sort by position so the extraction order matches the document ────────
    # Handles both 10-Q (financials → mda → risk_factors) and
    # 10-K (risk_factors → mda → financials) layouts automatically.
    doc_order = sorted(boundaries.keys(), key=lambda k: boundaries[k])
    logger.info("Detected section order in document: %s", doc_order)

    result: dict[str, str] = {}
    for idx, name in enumerate(doc_order):
        start = boundaries[name] + 1

        # End at the start of the next section that appears later in the doc
        later_boundaries = [
            boundaries[n]
            for n in doc_order[idx + 1 :]
            if boundaries[n] > start
        ]
        end = min(later_boundaries) if later_boundaries else start + _MAX_SECTION_PARAS

        text = "\n".join(paragraphs[start:end]).strip()
        if text:
            result[name] = text
        else:
            logger.warning(
                "Section '%s' found at para %d but extracted empty text",
                name, boundaries[name],
            )

    found   = list(result.keys())
    missing = [n for n in SECTION_PATTERNS if n not in result]
    if missing:
        # Missing only "financials" when MDA + risk_factors are present is expected
        # for filings where financial tables render as sparse XBRL paragraphs
        # (< 1000 chars in next 50 paragraphs).  The financials section text is not
        # used by the analysis pipeline — extract_financials() handles table data.
        level = (
            logger.debug
            if missing == ["financials"] and "mda" in result and "risk_factors" in result
            else logger.warning
        )
        level("Extracted sections: %s. Missing: %s", found, missing)
    else:
        logger.info("All sections extracted successfully: %s", found)

    return result
