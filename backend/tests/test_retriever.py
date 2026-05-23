"""
Tests for RAG retrieval — uses rag.indexer.retrieve (the single-index variant).
"""
from rag.indexer import build_index, retrieve

Q2_TEXT = "Gross margin was 44% in Q2. iPhone revenue declined slightly due to market saturation."
Q3_TEXT = "Gross margin expanded to 46% in Q3. Services revenue hit record highs this quarter."


def test_retrieve_returns_results(tmp_path):
    q2_dir = str(tmp_path / "Q2-2024")
    build_index(Q2_TEXT, q2_dir)
    results = retrieve("gross margin", q2_dir, top_k=1)
    assert isinstance(results, list)
    assert len(results) > 0


def test_retrieve_returns_strings(tmp_path):
    q3_dir = str(tmp_path / "Q3-2024")
    build_index(Q3_TEXT, q3_dir)
    results = retrieve("services revenue record", q3_dir, top_k=1)
    assert len(results) > 0
    assert isinstance(results[0], str)


def test_retrieve_returns_empty_for_missing_index(tmp_path):
    missing_dir = str(tmp_path / "NONEXISTENT")
    results = retrieve("any query", missing_dir, top_k=3)
    assert results == []


def test_retrieve_top_k_respected(tmp_path):
    q3_dir = str(tmp_path / "Q3-2024-topk")
    # Build with more text so there are multiple chunks
    long_text = " ".join([Q3_TEXT] * 20)
    build_index(long_text, q3_dir)
    results = retrieve("margin", q3_dir, top_k=2)
    assert len(results) <= 2
