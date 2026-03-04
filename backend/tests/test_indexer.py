import json
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
import numpy as np


def test_chunk_text_basic():
    from rag.indexer import _chunk_text
    text = "a" * 600
    chunks = _chunk_text(text)
    assert len(chunks) >= 2
    for chunk in chunks:
        assert len(chunk) <= 512


def test_chunk_text_empty():
    from rag.indexer import _chunk_text
    assert _chunk_text("") == []


def test_chunk_text_short():
    from rag.indexer import _chunk_text
    chunks = _chunk_text("hello world")
    assert chunks == ["hello world"]


def test_build_index_skips_if_exists(tmp_path):
    from rag.indexer import build_index
    (tmp_path / "index.faiss").write_bytes(b"")
    (tmp_path / "chunks.json").write_text("[]")
    # Should return immediately without calling embedder
    with patch("rag.indexer._load_embedder") as mock_emb:
        build_index("some text", str(tmp_path))
        mock_emb.assert_not_called()
