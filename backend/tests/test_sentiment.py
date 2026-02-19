import pytest
from unittest.mock import patch, MagicMock
from analysis.sentiment import aggregate_scores, _split_paragraphs


def test_aggregate_scores_all_positive():
    scored = [({"positive": 1.0, "negative": 0.0, "neutral": 0.0}, 10)]
    result = aggregate_scores(scored)
    assert result["positive"] == pytest.approx(1.0)


def test_aggregate_scores_zero_weight():
    result = aggregate_scores([])
    assert result == {"positive": 0.0, "negative": 0.0, "neutral": 1.0}


def test_aggregate_scores_weighted():
    scored = [
        ({"positive": 1.0, "negative": 0.0, "neutral": 0.0}, 2),
        ({"positive": 0.0, "negative": 1.0, "neutral": 0.0}, 2),
    ]
    result = aggregate_scores(scored)
    assert result["positive"] == pytest.approx(0.5)
    assert result["negative"] == pytest.approx(0.5)


def test_split_paragraphs_basic():
    text = "Revenue grew strongly. We expect continued growth. Margins expanded."
    paras = _split_paragraphs(text, max_words=5)
    assert len(paras) >= 2


def test_split_paragraphs_empty():
    assert _split_paragraphs("") == []
