<div align="center">
<h1>FinSight</h1>
<p><strong>AI-Powered Earnings Intelligence Platform for Financial Document Analysis</strong></p>
<p>
  <a href="https://github.com/anushkaanair/FinSight"><img src="https://img.shields.io/badge/GitHub-FinSight-181717?style=flat&logo=github" alt="GitHub"/></a>
  <a href="mailto:anushkanair93@gmail.com"><img src="https://img.shields.io/badge/Contact-anushkanair93%40gmail.com-EA4335?style=flat&logo=gmail&logoColor=white" alt="Email"/></a>
  <a href="https://linkedin.com/in/anushka-nair"><img src="https://img.shields.io/badge/LinkedIn-Anushka_Nair-0A66C2?style=flat&logo=linkedin&logoColor=white" alt="LinkedIn"/></a>
</p>
<p>
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?style=flat&logo=fastapi&logoColor=white"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black"/>
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/FinBERT-NLP-FF6F00?style=flat"/>
  <img src="https://img.shields.io/badge/FAISS-Vector_Search-FF6F00?style=flat"/>
  <img src="https://img.shields.io/badge/SEC_EDGAR-API-003087?style=flat"/>
  <img src="https://img.shields.io/badge/LangChain-RAG-1C3C3C?style=flat"/>
  <img src="https://img.shields.io/badge/Docker-Containerized-2496ED?style=flat&logo=docker&logoColor=white"/>
  <img src="https://img.shields.io/badge/Status-Active_Development-brightgreen?style=flat"/>
</p>
<p>
  <a href="#-what-is-finsight">Overview</a> ·
  <a href="#-pipeline-architecture">Architecture</a> ·
  <a href="#-key-features">Features</a> ·
  <a href="#-tech-stack">Tech Stack</a> ·
  <a href="#-setup">Setup</a> ·
  <a href="#-api-reference">API</a> ·
  <a href="#-roadmap">Roadmap</a>
</p>
</div>

💡 What is FinSight?
FinSight is an AI-powered earnings intelligence platform that automates what a junior investment banking or equity research analyst does manually every quarter: ingesting SEC filings and earnings call transcripts, extracting structured financial signals, detecting tone shifts across reporting periods, and surfacing everything through a natural language Q&A interface.
Ask questions like:

"What did Apple's CFO say about gross margin pressure in Q4?"
"How has Amazon's guidance tone shifted from Q2 to Q3?"
"Which risk factors are new in this 10-K versus last year?"

FinSight answers them in seconds — with citations back to the exact filing passage.
Who it's built for: Equity researchers, investment analysts, FinTech developers, and anyone who needs to process financial disclosures at scale without reading hundreds of pages manually.

🏗️ Pipeline Architecture
┌──────────────────────────────────────────────────────────────────────┐
│                        FinSight Pipeline                             │
│                                                                      │
│  ┌─────────────────────────────────────┐                            │
│  │         Data Ingestion Layer        │                            │
│  │  SEC EDGAR API · Earnings APIs      │                            │
│  │  10-K · 10-Q · Earnings Transcripts │                            │
│  └──────────────────┬──────────────────┘                            │
│                     │                                                │
│                     ▼                                                │
│  ┌─────────────────────────────────────┐                            │
│  │        Document Processing          │                            │
│  │  Section extraction · Chunking      │                            │
│  │  Period tagging · Metadata enrichment│                           │
│  └──────────────────┬──────────────────┘                            │
│                     │                                                │
│                     ▼                                                │
│  ┌─────────────────────────────────────┐                            │
│  │      Temporal Vector Store          │                            │
│  │  FAISS · Period-tagged embeddings   │                            │
│  │  Q-over-Q isolation · Company index │                            │
│  └──────┬──────────────────┬───────────┘                            │
│         │                  │                                         │
│         ▼                  ▼                                         │
│  ┌─────────────┐   ┌──────────────────┐   ┌──────────────────────┐ │
│  │ Temporal    │   │  FinBERT Signal   │   │   NL Q&A Engine      │ │
│  │ RAG Engine  │   │  Extractor        │   │   LangChain LCEL     │ │
│  │ Q-over-Q    │   │  Sentiment ·      │   │   Source-cited       │ │
│  │ retrieval   │   │  Guidance tone ·  │   │   answers            │ │
│  │             │   │  Risk delta       │   │                      │ │
│  └──────┬──────┘   └──────────┬────────┘   └──────────┬───────────┘ │
│         │                     │                        │             │
│         └──────────┬──────────┘                        │             │
│                    ▼                                   │             │
│  ┌─────────────────────────────────────┐              │             │
│  │        LLM Synthesis Layer          │◀─────────────┘             │
│  │  Structured narrative generation    │                            │
│  │  Cross-period comparison            │                            │
│  │  Analyst brief assembly             │                            │
│  └──────────────────┬──────────────────┘                            │
│                     │                                                │
│                     ▼                                                │
│  ┌─────────────────────────────────────┐                            │
│  │           Output Layer              │                            │
│  │  Sentiment score · Guidance tone    │                            │
│  │  Risk delta · Q&A interface         │                            │
│  │  Auto-generated analyst brief       │                            │
│  └─────────────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────────────┘

✨ Key Features
📥 Automated Data Ingestion

Pulls 10-K and 10-Q filings directly from the SEC EDGAR public API — no manual downloads
Ingests earnings call transcripts from financial data APIs
Parses and chunks documents by section (Risk Factors, MD&A, Forward Guidance, Financial Statements)
Tags every chunk with company ticker, filing period, and document type for temporal retrieval

🧠 Temporal RAG (Quarter-over-Quarter Retrieval)

FAISS vector store with period-scoped indexing — queries can be isolated to Q3 2024 or compared across Q2 vs Q3
Retrieves semantically relevant passages from the correct filing period, not just the most recent
Enables cross-period comparison: "What changed in the risk factors between this 10-K and last year's?"

📊 FinBERT Signal Extraction

Runs FinBERT (finance-domain pre-trained BERT) over earnings call transcripts and MD&A sections
Extracts structured signals per section:

Management sentiment score (positive / neutral / negative, 0.0–1.0)
Forward guidance tone (optimistic / cautious / negative)
Risk factor delta — new risks added, existing risks removed vs prior period


Outputs a per-company, per-period signal table queryable via API

💬 Natural Language Q&A with Source Citations

Ask any question in plain English; FinSight retrieves the most relevant filing passages and generates a cited answer
Every answer includes source citations: company, filing type, period, section, and page reference
Powered by LangChain LCEL with retrieval-augmented generation over the FAISS index

📝 Auto-Generated Analyst Brief

One-click generation of a structured analyst brief per company per period
Brief includes: executive summary, sentiment trend, guidance highlights, key risk changes, and notable management quotes (cited)
Output as structured JSON or formatted PDF

📈 Visualization Dashboard

Sentiment trend charts across quarters (Recharts)
Keyword frequency heatmaps across filings
Risk factor delta timeline
Guidance tone tracker


🛠️ Tech Stack
LayerTechnologyFrontendReact 18 · TypeScript · Tailwind CSS · RechartsBackendFastAPI · Python 3.11AI / NLPFinBERT (ProsusAI/finbert) · LangChain LCEL · FAISS · OpenAI / GroqData SourcesSEC EDGAR REST API · Earnings call transcript APIsDatabasePostgreSQL · SQLAlchemyInfrastructureDocker · Docker ComposeDocument Processingpdfplumber · BeautifulSoup · tiktoken

📁 Project Structure
FinSight/
├── backend/
│   ├── ingestion/
│   │   ├── edgar_client.py        # SEC EDGAR API wrapper
│   │   ├── transcript_parser.py   # Earnings call ingestion
│   │   └── document_chunker.py    # Section extraction + period tagging
│   ├── rag/
│   │   ├── faiss_store.py         # Temporal vector store
│   │   ├── embedder.py            # Sentence embedding pipeline
│   │   └── retriever.py           # Period-scoped retrieval
│   ├── signals/
│   │   ├── finbert_extractor.py   # FinBERT sentiment + guidance
│   │   └── risk_delta.py          # Q-over-Q risk factor diff
│   ├── synthesis/
│   │   ├── qa_engine.py           # NL Q&A with LangChain LCEL
│   │   └── brief_generator.py     # Analyst brief assembly
│   ├── api/
│   │   └── routes/
│   └── main.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar/
│   │   │   ├── AnalystBrief/
│   │   │   ├── SentimentChart/
│   │   │   └── QAInterface/
│   │   └── App.tsx
├── docker-compose.yml
├── Dockerfile
└── README.md

🚀 Setup
Prerequisites

Python 3.11+, Node.js 18+, Docker & Docker Compose, PostgreSQL 15

bash# Clone
git clone https://github.com/anushkaanair/FinSight.git
cd FinSight

# Quickstart with Docker
docker-compose up --build

# --- Or run locally ---

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
Environment Variables
envDATABASE_URL=postgresql://user:password@localhost:5432/finsight
OPENAI_API_KEY=sk-...
EDGAR_USER_AGENT=YourName your@email.com   # Required by SEC EDGAR API
FINBERT_MODEL=ProsusAI/finbert
EMBEDDING_MODEL=all-MiniLM-L6-v2

SEC EDGAR API is free and public — no API key required, only a User-Agent header per their fair-use policy.


📡 API Reference
MethodEndpointDescriptionPOST/api/v1/ingest/tickerIngest all filings for a ticker (e.g. AAPL)GET/api/v1/filings/{ticker}List available filings by periodPOST/api/v1/queryNatural language Q&A over filingsGET/api/v1/signals/{ticker}/{period}FinBERT signal extraction for a periodGET/api/v1/delta/{ticker}Risk factor delta across periodsPOST/api/v1/brief/{ticker}/{period}Generate auto analyst briefGET/api/v1/sentiment/trend/{ticker}Sentiment trend across all indexed periods
Example Query
bashcurl -X POST http://localhost:8000/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "period": "Q4-2024",
    "question": "What did management say about gross margin pressure?"
  }'
json{
  "answer": "Management acknowledged gross margin compression driven by product mix shift toward services...",
  "citations": [
    {
      "source": "AAPL 10-Q Q4-2024",
      "section": "Management Discussion & Analysis",
      "passage": "...",
      "confidence": 0.91
    }
  ]
}

🗺️ Roadmap

 SEC EDGAR ingestion pipeline
 Document chunking with period tagging
 FAISS temporal vector store
 FinBERT sentiment + guidance extraction
 Natural language Q&A with source citations
 Auto analyst brief generation
 Multi-company comparative analysis (e.g., AAPL vs MSFT Q3)
 Earnings surprise detection (guidance vs consensus)
 Email digest for tracked tickers
 Multilingual filing support


👤 Author
Anushka Nair — B.Tech CSE (AI & ML), SRM Institute of Science and Technology
Show Image
Show Image
Show Image

<div align="center">
<sub>Built for FinTech · © 2025 Anushka Nair · SRM Institute of Science and Technology</sub>
</div>
