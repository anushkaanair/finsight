from analysis.guidance import extract_guidance

MDA = """
Revenue grew 6% year-over-year to $89.5 billion this quarter.
We expect continued growth in our Services segment going forward.
We anticipate headwinds from foreign exchange rates in the coming quarter.
We project mid-single-digit growth in iPhone revenue next year.
The macroeconomic environment remains uncertain and challenging.
Capital expenditures remained stable at $2.9 billion.
"""


def test_extracts_forward_looking_sentences():
    signals = extract_guidance(MDA)
    texts = [s["text"] for s in signals]
    assert any("expect" in t.lower() for t in texts)
    assert any("anticipate" in t.lower() for t in texts)


def test_tags_optimistic_signals():
    signals = extract_guidance(MDA)
    assert any(s["tag"] == "optimistic" for s in signals)


def test_tags_cautious_signals():
    signals = extract_guidance(MDA)
    assert any(s["tag"] == "cautious" for s in signals)


def test_non_forward_looking_excluded():
    signals = extract_guidance(MDA)
    texts = [s["text"] for s in signals]
    assert not any("$89.5 billion" in t for t in texts)


def test_each_signal_has_required_keys():
    for s in extract_guidance(MDA):
        assert "text" in s and "tag" in s and "offset" in s
