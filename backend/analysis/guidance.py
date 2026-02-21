import re

FORWARD_PATTERNS = re.compile(
    r"\b(we expect|we anticipate|we project|we believe|going forward|"
    r"outlook|next quarter|next year|in the coming|we plan|we intend|"
    r"we forecast|we target)\b",
    re.IGNORECASE,
)

OPTIMISTIC_PATTERNS = re.compile(
    r"\b(growth|strong|record|increase|expand|robust|opportunity|"
    r"momentum|acceleration|outperform|beat|exceed)\b",
    re.IGNORECASE,
)

CAUTIOUS_PATTERNS = re.compile(
    r"\b(headwind|uncertainty|uncertain|challenge|challenging|"
    r"decline|decrease|pressure|risk|volatility|impact|concern|"
    r"difficult|slower|weaker)\b",
    re.IGNORECASE,
)


def _tag_sentence(sentence: str) -> str:
    optimistic_hits = len(OPTIMISTIC_PATTERNS.findall(sentence))
    cautious_hits = len(CAUTIOUS_PATTERNS.findall(sentence))
    if optimistic_hits > cautious_hits:
        return "optimistic"
    if cautious_hits > optimistic_hits:
        return "cautious"
    return "neutral"


def extract_guidance(mda_text: str) -> list:
    sentences = re.split(r"(?<=[.!?])\s+", mda_text)
    signals = []
    offset = 0
    for sentence in sentences:
        sentence = sentence.strip()
        if sentence and FORWARD_PATTERNS.search(sentence):
            signals.append({
                "text": sentence,
                "tag": _tag_sentence(sentence),
                "offset": mda_text.find(sentence, offset),
            })
        offset = mda_text.find(sentence, offset) + len(sentence)
    return signals
