from analysis.risk_delta import compute_risk_delta

OLD = """Competition in our markets is intense and growing.
Macroeconomic conditions may adversely affect demand.
Our supply chain depends on third-party manufacturers."""

NEW = """Competition in our markets is intense and continues to accelerate.
Macroeconomic conditions may adversely affect consumer demand for our products.
Geopolitical tensions may disrupt our global operations.
Regulatory changes in the EU may impact our business model."""


def test_detects_added_risks():
    delta = compute_risk_delta(OLD, NEW)
    added_text = " ".join(delta["added"])
    assert "Geopolitical" in added_text or "Regulatory" in added_text


def test_detects_removed_risks():
    delta = compute_risk_delta(OLD, NEW)
    removed_text = " ".join(delta["removed"])
    assert "supply chain" in removed_text.lower()


def test_detects_modified_risks():
    delta = compute_risk_delta(OLD, NEW)
    assert len(delta["modified"]) > 0
    old_v, new_v = delta["modified"][0]
    assert "Competition" in old_v and "Competition" in new_v


def test_identical_text_returns_empty_delta():
    delta = compute_risk_delta(OLD, OLD)
    assert delta["added"] == []
    assert delta["removed"] == []
    assert delta["modified"] == []
