<div align="center">

<h1>FinSight</h1>
<p><strong>Automated Equity Research — SEC Filings → FinBERT → FAISS RAG → Groq Llama-3 Analyst Chat</strong></p>

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
  <img src="https://img.shields.io/badge/Groq-Llama--3-00C896?style=flat"/>
  <img src="https://img.shields.io/badge/FAISS-Vector_Search-00BFFF?style=flat"/>
  <img src="https://img.shields.io/badge/SEC_EDGAR-Free_API-003087?style=flat"/>
  <img src="https://img.shields.io/badge/SQLite-Persistence-003B57?style=flat&logo=sqlite&logoColor=white"/>
  <img src="https://img.shields.io/badge/Status-Active-brightgreen?style=flat"/>
</p>

<p>
  <a href="#-what-is-finsight">Overview</a> ·
  <a href="#-pipeline">Pipeline</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-tech-stack">Stack</a> ·
  <a href="#-setup">Setup</a> ·
  <a href="#-api">API</a>
</p>

</div>

---

## 💡 What is FinSight?

FinSight automates what a junior equity research analyst does every quarter — ingesting SEC 10-K/10-Q filings directly from EDGAR, scoring sentiment with FinBERT, detecting Q-over-Q risk factor changes, extracting forward guidance, parsing financial tables, and delivering a structured analyst brief with Groq Llama-3 chat — **fully free, no paid infrastructure, runs locally**.

Ask questions like:

> *"What changed in Apple's risk factors this quarter versus last?"*  
> *"What is the forward guidance tone in Microsoft's MD&A?"*  
> *"How does NVDA's gross margin compare to MSFT this quarter?"*

FinSight answers with source-cited passages from the actual SEC filing, powered by FAISS RAG and Groq Llama-3.

---

## 🏗️ Pipeline

```
SEC EDGAR (free, no API key)
     │
     ▼
edgar_client.py  ─── ticker → CIK lookup → 10-Q / 10-K HTML (cached locally)
     │
     ▼
parser.py  ─── BeautifulSoup extracts: Risk Factors · MD&A · Financial Tables
     │
     ├──▶  sentiment.py    ─── FinBERT paragraph scoring → weighted composite
     ├──▶  risk_delta.py   ─── difflib sentence-level Q-over-Q diff
     ├──▶  guidance.py     ─── regex forward-looking signal extractor
     └──▶  financials.py   ─── HTML table parser → Revenue / EPS / Margins
     │
     ▼
indexer.py   ─── all-MiniLM-L6-v2 → FAISS IndexFlatL2 (one index per quarter)
     │
     ▼
retriever.py ─── cross-quarter temporal RAG
     │
     ▼
engine.py    ─── Groq Llama-3.3-70b answers questions with retrieved context
     │
     ▼
app.py       ─── Flask REST API → SQLite persistence → Next.js 14 frontend
```

---

## ✨ Features

### 📥 Automated Ingestion — Zero Cost
- Fetches 10-K and 10-Q filings from **SEC EDGAR** public REST API (no key needed)
- Ticker → CIK resolution with module-level caching
- Dual-field compatibility for EDGAR API changes (`reportDate` / `periodOfReport`)
- HTML filings cached to `data/{cik}/{quarter}/filing.html` — reruns are instant

### 🧠 NLP Analysis Stack
- **FinBERT** (`ProsusAI/finbert`) — paragraph-level sentiment scoring
- Weighted composite: `positive / negative / neutral` across full MD&A
- Sentence-level **risk factor delta** via `difflib` (added · removed · modified)
- Regex **forward guidance** tagger: `optimistic / cautious / neutral`

### 💰 Financial Table Extraction
- BeautifulSoup HTML table parser extracts from SEC filings:
  - Revenue, Net Income, Gross Profit, Operating Income
  - EPS (basic & diluted), Total Assets, R&D Expense
  - Computed margins: Gross · Operating · Net
- Animated margin bar charts in the UI

### 🤖 Groq AI Chat (Llama-3.3-70b)
- **Groq API** with `llama-3.3-70b-versatile` — near-instant inference
- System prompt: *"You are a senior equity research analyst with 15 years of experience…"*
- FAISS RAG injects relevant filing passages as context per question
- Graceful fallback to keyword extraction if Groq API key is absent
- Chat panel lives next to the 3D robot — open by default

### 📈 Temporal Q-over-Q RAG
- `all-MiniLM-L6-v2` embeddings → **FAISS** `IndexFlatL2` (per quarter)
- Cross-quarter retriever for longitudinal comparison queries
- Runs entirely on CPU — no GPU, no server

### 🗃️ SQLite Persistence
- `finsight.db` stores every completed analysis result
- **History panel** — last 15 analyses, reload any past result instantly
- **Watchlist** — starred tickers with last sentiment label
- No setup required — auto-initialised on first run

### 📊 Multi-Ticker Comparison (`/compare`)
- Compare up to 4 tickers simultaneously side-by-side
- Preset groups: FAANG · Big Tech · Big Banks · EV
- Per-ticker: sentiment bars, risk delta counts, guidance breakdown, financials, brief

### 📡 Live Market Data
- `yfinance` fetches price, P/E ratio, market cap, 52-week high/low
- Market tab in results — no paid data subscription

### 🖥️ Web UI — Recruiter-Grade Design
- **Next.js 14** App Router · TypeScript · Tailwind CSS · framer-motion
- **Fonts**: Syne 800 (display headings) · IBM Plex Sans (body) · JetBrains Mono (data)
- Dark corporate finance aesthetic — near-black `#05080A`, teal accent `#00C896`
- **Live ticker tape** — animated market prices strip below the header
- **Staggered hero animations** — framer-motion fadeUp with spring timing
- **Animated tab underline** — spring `layoutId` transition between tabs
- **Animated bar charts** — `motion.div` width transitions on sentiment & margins
- **Color-coded card accents** — result cards have top borders matching data color
- Full-size Spline 3D robot fixed bottom-right — acts as AI chat trigger
- Circular radial nav (fan-out) · glass-card result panels
- `⚡ DEMO` button — loads full Apple Q1-2024 mock data without Flask

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| **UI Library** | shadcn/ui · framer-motion · Lucide icons |
| **3D** | @splinetool/react-spline |
| **Backend** | Flask · flask-cors · Python 3.11 |
| **AI Chat** | Groq API (`llama-3.3-70b-versatile`) |
| **NLP** | `ProsusAI/finbert` · `sentence-transformers/all-MiniLM-L6-v2` |
| **Vector DB** | `faiss-cpu` — fully local, no server |
| **Persistence** | SQLite (Python built-in `sqlite3`) |
| **Market Data** | `yfinance` — free, no API key |
| **Data Source** | SEC EDGAR REST API — free, no API key |
| **Env** | `python-dotenv` — `.env` for Groq key |

---

## 📁 Project Structure

```
finsight/
├── backend/
│   ├── ingestion/
│   │   ├── edgar_client.py     # SEC EDGAR API — ticker → CIK → filing HTML
│   │   └── parser.py           # BeautifulSoup section extractor
│   ├── analysis/
│   │   ├── sentiment.py        # FinBERT scoring + aggregation
│   │   ├── risk_delta.py       # Q-over-Q risk factor diff
│   │   ├── guidance.py         # Forward guidance signal extractor
│   │   └── financials.py       # HTML table → Revenue / EPS / Margins
│   ├── rag/
│   │   ├── indexer.py          # FAISS index builder (one per quarter)
│   │   └── retriever.py        # Cross-quarter temporal retriever
│   ├── chat/
│   │   ├── engine.py           # Groq Llama-3 RAG chat engine
│   │   └── market.py           # yfinance live market data
│   ├── reporting/
│   │   └── brief.py            # Analyst brief assembly
│   ├── db.py                   # SQLite: save_analysis, history, watchlist
│   ├── app.py                  # Flask factory + REST API (12 endpoints)
│   ├── .env                    # GROQ_API_KEY (not committed)
│   └── data/
│       └── finsight.db         # SQLite database (auto-created)
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Main dashboard (hero + results + chat)
│   │   │   ├── compare/
│   │   │   │   └── page.tsx    # Multi-ticker comparison page
│   │   │   ├── layout.tsx      # Root layout — Syne + IBM Plex + JetBrains Mono
│   │   │   └── globals.css     # Design tokens · animations · ticker tape
│   │   ├── components/ui/
│   │   │   ├── splite.tsx      # Spline 3D robot wrapper
│   │   │   └── ...             # shadcn components
│   │   ├── lib/
│   │   │   ├── api.ts          # Flask API client (analyze, chat, watchlist…)
│   │   │   └── utils.ts
│   │   └── types/
│   │       └── brief.ts        # TypeScript interfaces (AnalysisResult, etc.)
│   └── public/
└── README.md
```

---

## 🚀 Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- ~2 GB free disk (FinBERT + embeddings model, downloaded on first run)
- Groq API key (free at [console.groq.com](https://console.groq.com))

### Backend

```bash
git clone https://github.com/anushkaanair/finsight.git
cd finsight/backend

# Install dependencies (no venv needed, or use one)
pip install flask flask-cors transformers torch sentence-transformers \
            faiss-cpu yfinance requests beautifulsoup4 lxml \
            groq python-dotenv reportlab click rich

# Add your Groq API key
echo "GROQ_API_KEY=your_key_here" > .env

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

> **Try it without Flask** — click **⚡ DEMO** on the homepage to load a full Apple Q1-2024 analysis instantly with no backend required.

---

## 📡 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze` | Full analysis — sentiment, risk delta, guidance, financials, brief |
| `POST` | `/api/compare` | Multi-ticker comparison (up to 4) |
| `POST` | `/api/chat` | Groq Llama-3 RAG chat with filing context |
| `GET`  | `/api/market/<ticker>` | Live market data (yfinance) |
| `GET`  | `/api/history?limit=N` | Recent analysis history from SQLite |
| `GET`  | `/api/trend/<ticker>` | Sentiment trend over time |
| `GET`  | `/api/watchlist` | Get watchlist |
| `POST` | `/api/watchlist` | Add ticker to watchlist |
| `DELETE` | `/api/watchlist/<ticker>` | Remove from watchlist |

### Analyze Example

```bash
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL", "quarter": "Q1-2024"}'
```

```json
{
  "ticker": "AAPL",
  "quarter": "Q1-2024",
  "sentiment": { "label": "positive", "score": { "positive": 0.71, "negative": 0.14, "neutral": 0.15 }, "trend": "up" },
  "guidance": [{ "text": "We expect revenue in the range of $88–92B...", "tag": "optimistic" }],
  "risk_delta": { "added": [...], "removed": [...], "modified": [...] },
  "financials": { "revenue": "$119.6B", "gross_margin": "45.9%", "eps_diluted": "2.18" },
  "market": { "price": 189.30, "pe_ratio": 29.4, "market_cap": 2920000000000 },
  "brief": "Apple Q1-FY2024: $119.6B revenue..."
}
```

### Chat Example

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the key risks?", "ticker": "AAPL", "context": "..."}'
```

---

## 🗺️ Roadmap

- [x] SEC EDGAR ingestion pipeline (10-K + 10-Q)
- [x] Section parser (Risk Factors · MD&A · Financial Tables)
- [x] FinBERT sentiment scoring + aggregation
- [x] Q-over-Q risk factor delta
- [x] Forward guidance signal extraction
- [x] Financial table extraction (Revenue / EPS / Margins)
- [x] FAISS temporal vector store (per quarter)
- [x] Cross-quarter RAG retriever
- [x] Groq Llama-3 analyst chat engine
- [x] Flask REST API (9 endpoints)
- [x] SQLite persistence — history + watchlist
- [x] Multi-ticker comparison page (`/compare`)
- [x] Next.js UI — Syne/IBM Plex Sans, ticker tape, animated charts
- [x] Spline 3D robot chat trigger
- [x] ⚡ Demo mode (no Flask required)
- [ ] Earnings surprise detection (guidance vs consensus)
- [ ] Email digest for watchlist tickers
- [ ] PDF export of full analyst report

---

<div align="center">
<sub>Built by Anushka Nair · B.Tech CSE (AI & ML), SRM Institute of Science and Technology</sub>
<br/>
<sub>SEC EDGAR is a free public API. Groq free tier is sufficient for all chat features. No paid infrastructure required anywhere.</sub>
</div>
