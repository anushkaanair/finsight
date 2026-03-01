import numpy as np
from rag.indexer import load_index, _load_embedder


def retrieve(query: str, quarter_dirs: dict, top_k: int = 5) -> dict:
    embedder = _load_embedder()
    query_vec = embedder.encode([query], show_progress_bar=False).astype(np.float32)

    results = {}
    for quarter, index_dir in quarter_dirs.items():
        index, chunks = load_index(index_dir)
        k = min(top_k, index.ntotal)
        distances, indices = index.search(query_vec, k)
        results[quarter] = [
            {"text": chunks[i]["text"], "score": float(distances[0][j])}
            for j, i in enumerate(indices[0])
            if i < len(chunks)
        ]
    return results
