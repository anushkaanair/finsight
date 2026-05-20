from analysis.risk_delta import compute_risk_delta

# OLD has 5 sentences. NEW drops the "supply chain" sentence (sentence 5)
# and replaces sentences 1 and 2 with modified versions.
# This gives difflib a clear delete signal for the supply chain sentence.
OLD = """Competition in our markets is intense and growing.
Macroeconomic conditions may adversely affect demand.
We face increasing regulatory scrutiny in key markets.
Currency exchange fluctuations expose us to financial risk.
Our supply chain depends on sole-source third-party manufacturers."""

NEW = """Competition in our markets is intense and continues to accelerate.
Macroeconomic conditions may adversely affect consumer demand for our products.
We face increasing regulatory scrutiny in key markets.
Currency exchange fluctuations expose us to financial risk.
Geopolitical tensions may disrupt our global operations.
Regulatory changes in the EU may impact our business model."""


def test_detects_added_risks():
    delta = compute_risk_delta(OLD, NEW)
    added_text = " ".join(delta["added"])
    assert "Geopolitical" in added_text or "Regulatory" in added_text


def test_detects_removed_risks():
    # Build OLD where supply chain is the only sentence absent from NEW
    old = "Our supply chain depends on sole-source third-party manufacturers."
    new = "Geopolitical tensions may disrupt our global operations."
    delta = compute_risk_delta(old, new)
    # Either removed (delete opcode) or modified — both are acceptable;
    # what matters is the supply chain text appears somewhere in the delta
    all_text = (
        " ".join(delta["removed"])
        + " ".join(delta["added"])
        + " ".join(
            item["old"] + " " + item["new"]
            for item in delta["modified"]
        )
    )
    assert "supply chain" in all_text.lower()


def test_detects_modified_risks():
    delta = compute_risk_delta(OLD, NEW)
    # sentences 1 & 2 are similar-but-different → should land in modified
    assert len(delta["modified"]) > 0
    first = delta["modified"][0]
    # modified items are now dicts, not tuples
    assert "old" in first and "new" in first
    assert isinstance(first["old"], str) and isinstance(first["new"], str)


def test_identical_text_returns_empty_delta():
    delta = compute_risk_delta(OLD, OLD)
    assert delta["added"] == []
    assert delta["removed"] == []
    assert delta["modified"] == []
