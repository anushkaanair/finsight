from pathlib import Path
from ingestion.parser import extract_sections

FIXTURE = Path(__file__).parent / "fixtures" / "sample_10q.html"


def test_extracts_mda_section():
    sections = extract_sections(FIXTURE.read_text())
    assert "mda" in sections
    assert "Revenue increased" in sections["mda"]


def test_extracts_risk_factors_section():
    sections = extract_sections(FIXTURE.read_text())
    assert "risk_factors" in sections
    assert "competition" in sections["risk_factors"]


def test_mda_does_not_bleed_into_risk_factors():
    sections = extract_sections(FIXTURE.read_text())
    assert "Revenue increased" not in sections["risk_factors"]


def test_returns_empty_for_missing_section():
    sections = extract_sections("<html><body><p>nothing here</p></body></html>")
    assert sections.get("mda", "") == ""
    assert sections.get("risk_factors", "") == ""
