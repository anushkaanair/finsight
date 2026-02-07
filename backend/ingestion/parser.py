import re
from bs4 import BeautifulSoup

SECTION_PATTERNS = {
    "risk_factors": re.compile(r"item\s*1a[\.\s]*risk\s*factor", re.IGNORECASE),
    "mda": re.compile(r"item\s*7[\.\s]*management", re.IGNORECASE),
    "financials": re.compile(r"item\s*8[\.\s]*financial\s*statement", re.IGNORECASE),
}

SECTION_ORDER = ["risk_factors", "mda", "financials"]


def extract_sections(html: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    paragraphs = [
        p.get_text(separator=" ", strip=True)
        for p in soup.find_all(["p", "div", "span", "td"])
    ]

    boundaries = {}
    for i, para in enumerate(paragraphs):
        for name, pattern in SECTION_PATTERNS.items():
            if pattern.search(para) and name not in boundaries:
                boundaries[name] = i

    result = {}
    for idx, name in enumerate(SECTION_ORDER):
        if name not in boundaries:
            continue
        start = boundaries[name] + 1
        next_boundaries = [
            boundaries[n]
            for n in SECTION_ORDER[idx + 1 :]
            if n in boundaries and boundaries[n] > start
        ]
        end = min(next_boundaries) if next_boundaries else start + 200
        result[name] = "\n".join(paragraphs[start:end]).strip()

    return result
