"""Central configuration constants for FinSight backend."""
from pathlib import Path

BASE_DIR   = Path(__file__).parent
DATA_DIR   = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"

# EDGAR
EDGAR_USER_AGENT  = "FinSight research@finsight.local"
EDGAR_RATE_SLEEP  = 0.12          # seconds between requests

# FinBERT
FINBERT_MODEL     = "ProsusAI/finbert"
FINBERT_MAX_WORDS = 150           # paragraph split size

# Embeddings / FAISS
EMBED_MODEL       = "all-MiniLM-L6-v2"
EMBED_DIM         = 384
CHUNK_SIZE        = 512
CHUNK_OVERLAP     = 64
EMBED_BATCH_SIZE  = 32

# Chat
CHAT_MODEL        = "google/flan-t5-base"
CHAT_MAX_INPUT    = 512
CHAT_MAX_OUTPUT   = 200
CHAT_CONTEXT_CHARS = 1500
