# FinSight Architecture

```
┌───────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                │
│  page.tsx  ──►  /api/analyze  ──►  /api/chat         │
└──────────────────────────┬────────────────────────────┘
                           │ HTTP (Flask)
┌──────────────────────────▼────────────────────────────┐
│                    Backend (Flask)                    │
│                                                       │
│  Ingestion          Analysis           RAG            │
│  ─────────          ────────           ───            │
│  EDGAR client  ──►  FinBERT        ──► FAISS index   │
│  HTML parser   ──►  Risk delta     ──► Retriever      │
│                ──►  Guidance           flan-t5-base   │
│                                                       │
│  Reporting                                            │
│  ─────────                                            │
│  Brief assembly  ──►  Rich CLI  ──►  PDF (ReportLab) │
└───────────────────────────────────────────────────────┘
```

## Data Flow

1. **Ingestion** — `edgar_client.py` resolves ticker → CIK, fetches the right
   10-Q or 10-K from EDGAR, and caches it to `data/{cik}/{quarter}/filing.html`.

2. **Parsing** — `parser.py` extracts three sections from the raw HTML:
   Risk Factors, MD&A, and Financial Statements.

3. **Analysis**
   - `sentiment.py` — FinBERT scores MD&A paragraphs; weighted average produces a
     composite label (positive / negative / neutral).
   - `risk_delta.py` — difflib computes sentence-level adds/removes/modifies
     between two consecutive quarters.
   - `guidance.py` — regex patterns find forward-looking statements and tag them
     optimistic / cautious / neutral.

4. **RAG** — `indexer.py` embeds filing text with `all-MiniLM-L6-v2` into a
   FAISS `IndexFlatL2`. `retriever.py` queries across multiple quarter indexes
   for temporal Q-over-Q context.

5. **Chat** — `engine.py` wraps `flan-t5-base` with a system prompt and retrieved
   context to answer free-form analyst questions locally at zero cost.

6. **Reporting** — `brief.py` assembles all signals into a structured dict;
   `cli_output.py` renders a Rich terminal report; `pdf_export.py` generates
   a ReportLab PDF.

## Tech Stack

| Layer      | Library                        | Why                          |
|------------|-------------------------------|-------------------------------|
| NLP        | `ProsusAI/finbert`            | Finance-tuned BERT            |
| Embeddings | `all-MiniLM-L6-v2`            | Fast, 384-dim, CPU-friendly   |
| Vector DB  | `faiss-cpu`                   | Exact L2 search, no server    |
| Chat LLM   | `google/flan-t5-base`         | ~900 MB, CPU-only, free       |
| API        | Flask + flask-cors            | Lightweight REST              |
| Frontend   | Next.js 14, Tailwind, shadcn  | App Router, TypeScript        |
| 3D         | @splinetool/react-spline      | Robot hero widget             |
