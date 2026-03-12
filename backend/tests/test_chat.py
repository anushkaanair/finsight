import pytest
from unittest.mock import patch, MagicMock


def test_answer_question_no_context():
    from chat.engine import answer_question
    result = answer_question("What was revenue?", "")
    assert "answer" in result
    assert result["sources"] == []


def test_answer_question_returns_sources():
    from chat.engine import answer_question
    sources = [{"text": "Revenue grew 12%", "quarter": "Q1-2024"}]
    with patch("chat.engine._load_model") as mock_load:
        tokenizer = MagicMock()
        model = MagicMock()
        tokenizer.return_value = {"input_ids": MagicMock()}
        model.generate.return_value = MagicMock()
        tokenizer.decode.return_value = "Revenue increased."
        mock_load.return_value = (tokenizer, model)
        result = answer_question("What was revenue?", "Revenue grew 12%.", sources)
    assert result["sources"] == sources


def test_is_market_question():
    from chat.market import is_market_question
    assert is_market_question("What is the current stock price?")
    assert is_market_question("What is the P/E ratio?")
    assert not is_market_question("What did management say about AI?")
