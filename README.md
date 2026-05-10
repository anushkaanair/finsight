<div align="center">

<h1>FinSight</h1>
<p><strong>Automated Equity Research — SEC Filings → FinBERT → RAG → Analyst Brief</strong></p>

<p>
  <a href="https://github.com/anushkaanair/finsight"><img src="https://img.shields.io/badge/GitHub-finsight-181717?style=flat&logo=github" alt="GitHub"/></a>
  <a href="mailto:anushkanair93@gmail.com"><img src="https://img.shields.io/badge/Contact-anushkanair93%40gmail.com-EA4335?style=flat&logo=gmail&logoColor=white" alt="Email"/></a>
  <a href="https://linkedin.com/in/anushka-nair"><img src="https://img.shields.io/badge/LinkedIn-Anushka_Nair-0A66C2?style=flat&logo=linkedin&logoColor=white" alt="LinkedIn"/></a>
</p>

<p>
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/Flask-Backend-000000?style=flat&logo=flask&logoColor=white"/>
  <img src="https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/FinBERT-NLP-FF6F00?style=flat"/>
  <img src="https://img.shields.io/badge/FAISS-Vector_Search-00BFFF?style=flat"/>
  <img src="https://img.shields.io/badge/SEC_EDGAR-Free_API-003087?style=flat"/>
  <img src="https://img.shields.io/badge/Cost-$0-brightgreen?style=flat"/>
  <img src="https://img.shields.io/badge/Status-Active-brightgreen?style=flat"/>
</p>

<p>
  <a href="#-what-is-finsight">Overview</a> ·
  <a href="#-pipeline">Pipeline</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-tech-stack">Stack</a> ·
  <a href="#-setup">Setup</a> ·
  <a href="#-api">API</a> ·
  <a href="#-cli">CLI</a>
</p>

</div>

---

## 💡 What is FinSight?

FinSight automates what a junior equity research analyst does every quarter — ingesting SEC 10-K/10-Q filings, scoring sentiment, detecting risk factor changes, extracting forward guidance, and assembling a structured analyst brief — all **fully free, no paid APIs, runs on CPU only**.

Ask questions like:

> *"What changed in Apple's risk factors this quarter versus last?"*  
> *"What is the forward guidance tone in Microsoft's MD&A?"*  
> *"How has Amazon's sentiment shifted from Q2 to Q3?"*

FinSight answers them with source-cited passages from the actual filing.

---

## 🏗️ Pipeline

```
SEC EDGAR (free)
     │
     ▼
edgar_client.py  ──  ticker → CIK → 10-Q / 10-K HTML (cached to disk)
     │
     ▼
parser.py  ──  BeautifulSoup extracts: Risk Factors · MD&A · Financials
     │
     ├──▶  sentiment.py   ──  FinBERT paragraph scoring → weighted label
     ├──▶  risk_delta.py  ──  difflib sentence-level Q-over-Q diff
     ├──▶  guidance.py    ──  regex forward-looking signal extractor
     │
     ▼
indexer.py  ──  all-MiniLM-L6-v2 → FAISS IndexFlatL2 (one index / quarter)
     │
     ▼
retriever.py  ──  top-k temporal RAG across quarters
     │
     ▼
engine.py   ──  flan-t5-base answers questions with retrieved context
     │
     ▼
brief.py    ──  structured analyst brief (JSON + PDF via ReportLab)
```

---

## ✨ Features

### 📥 Automated Ingestion — Zero Cost
- Fetches 10-K and 10-Q filings from **SEC EDGAR** public API (no key needed)
- Ticker → CIK resolution with module-level cache
- HTML filings cached to `data/{cik}/{quarter}/filing.html` — reruns are instant

### 🧠 Temporal Q-over-Q RAG
- `all-MiniLM-L6-v2` embeddings stored in **FAISS** per quarter
- Retriever queries across multiple quarter indexes simultaneously
- Enables cross-period comparison entirely on CPU

### 📊 FinBERT Signal Extraction
- **`ProsusAI/finbert`** scores every MD&A paragraph
- Weighted-average composite: `positive / negative / neutral`
- Sentence-level **risk factor delta** via `difflib` (added · removed · modified)
- Regex **forward guidance** tagger: `optimistic / cautious / neutral`

### 💬 Local RAG Chat
- **`google/flan-t5-base`** (~900 MB) — CPU-only, completely free
- System prompt: *"You are a financial analyst assistant…"*
- Auto-injects live market data (yfinance) for price/P-E/52w questions

### 📝 Analyst Brief
- Structured JSON brief: sentiment trend, guidance signals, risk deltas, RAG results
- Rich terminal output via `rich`
- **PDF export** via ReportLab

### 🖥️ Web UI
- Next.js 14 App Router · Tailwind CSS · shadcn/ui
- Dark green finance aesthetic with animated Spline 3D robot
- Radial orbital timeline showing the analysis pipeline
- Floating dock navigation · glass-card results panels
- Bottom-right AI chat widget

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui |
| **3D** | @splinetool/react-spline · framer-motion |
| **Backend** | Flask · flask-cors · Python 3.11 |
| **NLP** | `ProsusAI/finbert` · `google/flan-t5-base` |
| **Embeddings** | `sentence-transformers/all-MiniLM-L6-v2` |
| **Vector DB** | `faiss-cpu` — local, no server needed |
| **Market Data** | `yfinance` — free, no key |
| **Data Source** | SEC EDGAR REST API — free, no key |
| **PDF** | ReportLab |
| **CLI** | Click · Rich |

**Zero paid dependencies. Runs on any machine with <8 GB RAM.**

---

## 📁 Project Structure

```
finsight/
├── backend/
│   ├── ingestion/
│   │   ├── edgar_client.py     # SEC EDGAR API — ticker → CIK → filing
│   │   ├── parser.py           # BeautifulSoup section extractor
│   │   ├── validator.py        # Ticker / quarter validation
│   │   └── rate_limiter.py     # Token-bucket rate limiter (8 req/s)
│   ├── analysis/
│   │   ├── sentiment.py        # FinBERT scoring + aggregation
│   │   ├── risk_delta.py       # Q-over-Q risk factor diff
│   │   ├── guidance.py         # Forward guidance signal extractor
│   │   └── utils.py            # Shared text utilities
│   ├── rag/
│   │   ├── indexer.py          # FAISS index builder (one per quarter)
│   │   └── retriever.py        # Cross-quarter temporal retriever
│   ├── chat/
│   │   ├── engine.py           # flan-t5-base RAG chat engine
│   │   └── market.py           # yfinance live market data
│   ├── reporting/
│   │   ├── brief.py            # Analyst brief assembly
│   │   ├── cli_output.py       # Rich terminal output
│   │   ├── pdf_export.py       # ReportLab PDF generation
│   │   ├── formatter.py        # Number / date formatters
│   │   └── templates.py        # Plain-text brief templates
│   ├── tests/
│   │   ├── test_parser.py
│   │   ├── test_risk_delta.py
│   │   ├── test_guidance.py
│   │   ├── test_retriever.py
│   │   ├── test_sentiment.py
│   │   ├── test_indexer.py
│   │   └── test_chat.py
│   ├── config.py               # Central constants
│   ├── app.py                  # Flask factory + REST API
│   └── finsight_cli.py         # Click CLI entry point
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Main dashboard
│   │   │   ├── layout.tsx      # Root layout + metadata
│   │   │   ├── globals.css     # Dark green theme + animations
│   │   │   ├── error.tsx       # Error boundary
│   │   │   └── not-found.tsx   # 404 page
│   │   ├── components/ui/
│   │   │   ├── chatbot.tsx     # AI chat widget (flan-t5 via API)
│   │   │   ├── splite.tsx      # Spline 3D robot wrapper
│   │   │   ├── radial-orbital-timeline.tsx
│   │   │   ├── card.tsx · badge.tsx · button.tsx · skeleton.tsx
│   │   │   └── spotlight.tsx
│   │   ├── hooks/
│   │   │   └── useRecentTickers.ts
│   │   ├── lib/
│   │   │   ├── api.ts          # Flask API client
│   │   │   └── utils.ts        # cn() helper
│   │   └── types/
│   │       └── brief.ts        # TypeScript interfaces
│   └── public/
│       └── robots.txt
├── scripts/
│   └── backfill_index.py       # Bulk index builder
├── docs/
│   ├── architecture.md
│   └── edgar-api-notes.md
└── README.md
```

---

## 🚀 Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- ~3 GB free disk (for FinBERT + flan-t5-base + embeddings, downloaded on first run)

### Backend

```bash
git clone https://github.com/anushkaanair/finsight.git
cd finsight/backend

python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Start the Flask API
python app.py
# → http://localhost:5000
```

### Frontend

```bash
cd finsight/frontend
npm install
npm run dev
# → http://localhost:3000
```

### CLI (no server needed)

```bash
cd backend

# Single quarter brief
python finsight_cli.py --ticker AAPL --quarter Q1-2024

# Q-over-Q comparison with PDF
python finsight_cli.py --ticker MSFT --quarters Q2-2024 Q1-2024 --query "What changed this quarter?"

# Skip PDF
python finsight_cli.py --ticker NVDA --quarter Q3-2024 --no-pdf
```

---

## 📡 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/chat` | RAG chat (flan-t5-base) |
| `GET` | `/api/market/<ticker>` | Live market data (yfinance) |

### Chat Example

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What changed in risk factors this quarter?",
    "ticker": "AAPL",
    "context": "Revenue grew 12% YoY..."
  }'
```

```json
{
  "answer": "The filing highlights new risks around supply chain concentration...",
  "sources": []
}
```

---

## 🗺️ Roadmap

- [x] SEC EDGAR ingestion pipeline (10-K + 10-Q)
- [x] Section parser (Risk Factors · MD&A · Financials)
- [x] FinBERT sentiment scoring + aggregation
- [x] Q-over-Q risk factor delta
- [x] Forward guidance signal extraction
- [x] FAISS temporal vector store (per quarter)
- [x] Cross-quarter RAG retriever
- [x] flan-t5-base local chat engine
- [x] Flask REST API
- [x] Click CLI with PDF export
- [x] Next.js UI — dark green finance aesthetic
- [x] Spline 3D robot + orbital pipeline timeline
- [ ] Multi-company comparative analysis (AAPL vs MSFT)
- [ ] Earnings surprise detection (guidance vs consensus)
- [ ] Email digest for tracked tickers

---

<div align="center">
<sub>Built by Anushka Nair · B.Tech CSE (AI & ML), SRM Institute of Science and Technology</sub>
<br/>
<sub>SEC EDGAR is a free public API — no API keys required anywhere in this project.</sub>
</div>
