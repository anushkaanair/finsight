from rag.indexer import build_index
from rag.retriever import retrieve

Q2_TEXT = "Gross margin was 44% in Q2. iPhone revenue declined slightly due to market saturation."
Q3_TEXT = "Gross margin expanded to 46% in Q3. Services revenue hit record highs this quarter."


def test_retrieve_returns_results_for_each_quarter(tmp_path):
    q2_dir = str(tmp_path / "Q2-2024")
    q3_dir = str(tmp_path / "Q3-2024")
    build_index(Q2_TEXT, q2_dir)
    build_index(Q3_TEXT, q3_dir)

    results = retrieve("gross margin", {"Q2-2024": q2_dir, "Q3-2024": q3_dir}, top_k=1)

    assert "Q2-2024" in results
    assert "Q3-2024" in results


def test_retrieve_returns_relevant_chunks(tmp_path):
    q3_dir = str(tmp_path / "Q3-2024")
    build_index(Q3_TEXT, q3_dir)
    results = retrieve("services revenue record", {"Q3-2024": q3_dir}, top_k=1)
    assert len(results["Q3-2024"]) > 0


def test_each_result_has_required_keys(tmp_path):
    q3_dir = str(tmp_path / "Q3-2024")
    build_index(Q3_TEXT, q3_dir)
    results = retrieve("margin", {"Q3-2024": q3_dir}, top_k=1)
    for chunk in results["Q3-2024"]:
        assert "text" in chunk and "score" in chunk
