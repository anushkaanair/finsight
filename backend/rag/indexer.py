from __future__ import annotations
import json
from functools import lru_cache
from pathlib import Path
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

CHUNK_SIZE = 512
OVERLAP = 64
EMBED_MODEL = "all-MiniLM-L6-v2"
EMBED_DIM = 384


@lru_cache(maxsize=1)
def _load_embedder() -> SentenceTransformer:
    return SentenceTransformer(EMBED_MODEL)


def _chunk_text(text: str) -> list:
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start : start + CHUNK_SIZE].strip())
        start += CHUNK_SIZE - OVERLAP
    return [c for c in chunks if c]


def build_index(text: str, index_dir: str) -> None:
    index_path = Path(index_dir) / "index.faiss"
    chunks_path = Path(index_dir) / "chunks.json"

    if index_path.exists() and chunks_path.exists():
        return

    Path(index_dir).mkdir(parents=True, exist_ok=True)
    chunks = _chunk_text(text)
    embedder = _load_embedder()
    embeddings = embedder.encode(chunks, show_progress_bar=False).astype(np.float32)

    index = faiss.IndexFlatL2(EMBED_DIM)
    index.add(embeddings)

    faiss.write_index(index, str(index_path))
    chunks_path.write_text(json.dumps([{"text": c} for c in chunks]))


def load_index(index_dir: str) -> tuple:
    index_path = Path(index_dir) / "index.faiss"
    chunks_path = Path(index_dir) / "chunks.json"
    index = faiss.read_index(str(index_path))
    chunks = json.loads(chunks_path.read_text())
    return index, chunks


def retrieve(query: str, index_dir: str, top_k: int = 5) -> list[str]:
    """
    Semantic search over a pre-built FAISS index.
    Returns the top-k most relevant text chunks for the query.
    Returns an empty list if the index doesn't exist yet.
    """
    index_path = Path(index_dir) / "index.faiss"
    chunks_path = Path(index_dir) / "chunks.json"
    if not index_path.exists() or not chunks_path.exists():
        return []

    index, chunks = load_index(index_dir)
    embedder = _load_embedder()
    q_vec = embedder.encode([query], show_progress_bar=False).astype(np.float32)
    distances, indices = index.search(q_vec, min(top_k, len(chunks)))
    return [chunks[i]["text"] for i in indices[0] if i < len(chunks)]


def index_dir_for(ticker: str, quarter: str) -> str:
    """Canonical path for a ticker/quarter FAISS index."""
    return str(Path(__file__).parent.parent / "rag_indexes" / f"{ticker.upper()}_{quarter}")
