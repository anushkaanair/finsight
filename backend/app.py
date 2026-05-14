"""
FinSight Flask API
Endpoints:
  GET  /api/health
  POST /api/analyze          — full SEC filing analysis
  POST /api/compare          — side-by-side multi-ticker comparison
  POST /api/chat             — Groq RAG chat
  GET  /api/market/<ticker>  — live yfinance data
  GET  /api/history          — recent analyses from SQLite
  GET  /api/trend/<ticker>   — sentiment trend across quarters
  GET  /api/watchlist        — get watchlist
  POST /api/watchlist        — add to watchlist
  DELETE /api/watchlist/<t>  — remove from watchlist
"""
from __future__ import annotations
import logging
import os
from pathlib import Path
from datetime import datetime

from flask import Flask, request, jsonify
from flask_cors import CORS

from chat.engine import answer_question
from chat.market import get_market_snapshot, is_market_question, format_market_context
from ingestion.edgar_client import get_cik, download_filing
from ingestion.parser import extract_sections
from analysis.sentiment import score_mda
from analysis.risk_delta import compute_risk_delta
from analysis.guidance import extract_guidance
from analysis.financials import extract_financials
from db import (
    init_db, save_analysis, get_history, get_analysis,
    get_sentiment_trend, add_to_watchlist, remove_from_watchlist, get_watchlist,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── helpers ───────────────────────────────────────────────────────────────────

def _prev_quarter(quarter: str) -> str:
    """Return the immediately preceding quarter string."""
    q, year = quarter.split("-")
    year = int(year)
    order = ["Q1", "Q2", "Q3", "Q4"]
    idx = order.index(q.upper())
    if idx == 0:
        return f"Q4-{year - 1}"
    return f"{order[idx - 1]}-{year}"


def _run_analysis(ticker: str, quarter: str) -> dict:
    """
    Full pipeline: EDGAR → parse → sentiment → risk delta → guidance →
    financials → brief. Saves to SQLite and returns result dict.
    """
    # Check cache first
    cached = get_analysis(ticker, quarter)
    if cached:
        logger.info("Cache hit for %s %s", ticker, quarter)
        return cached

    # 1. Resolve CIK and download filing
    cik = get_cik(ticker)
    filing_path = download_filing(cik, quarter)
    html = Path(filing_path).read_text(encoding="utf-8", errors="replace")

    # 2. Extract sections
    sections = extract_sections(html)
    mda_text = sections.get("mda", "")
    risk_text = sections.get("risk_factors", "")

    if not mda_text and not risk_text:
        raise ValueError("Could not extract MD&A or Risk Factors from this filing.")

    # 3. Sentiment scoring
    sentiment = score_mda(mda_text) if mda_text else {"label": "neutral", "score": {"positive": 0, "negative": 0, "neutral": 1}}

    # 4. Risk factor delta (compare vs previous quarter)
    prev_q = _prev_quarter(quarter)
    risk_delta = {"added": [], "removed": [], "modified": []}
    try:
        prev_cik = get_cik(ticker)
        prev_path = download_filing(prev_cik, prev_q)
        prev_html = Path(prev_path).read_text(encoding="utf-8", errors="replace")
        prev_sections = extract_sections(prev_html)
        prev_risk = prev_sections.get("risk_factors", "")
        if prev_risk and risk_text:
            risk_delta = compute_risk_delta(prev_risk, risk_text)
    except Exception as e:
        logger.warning("Risk delta skipped (prev quarter unavailable): %s", e)

    # 5. Forward guidance
    guidance = extract_guidance(mda_text) if mda_text else []

    # 6. Financial table extraction
    financials = extract_financials(html)

    # 7. Live market data
    market = {}
    try:
        market = get_market_snapshot(ticker)
    except Exception:
        pass

    # 8. Assemble brief text
    pos = sentiment["score"].get("positive", 0)
    neg = sentiment["score"].get("negative", 0)
    lbl = sentiment["label"]
    brief = (
        f"{ticker.upper()} {quarter} filing analysis: FinBERT scores the MD&A as "
        f"{lbl} ({pos*100:.0f}% positive / {neg*100:.0f}% negative). "
        f"{len(guidance)} forward guidance signals detected "
        f"({sum(1 for g in guidance if g['tag']=='optimistic')} optimistic, "
        f"{sum(1 for g in guidance if g['tag']=='cautious')} cautious). "
        f"Risk factor delta: {len(risk_delta['added'])} new risks added, "
        f"{len(risk_delta['removed'])} removed vs prior quarter. "
    )
    if financials.get("revenue"):
        brief += f"Revenue: {financials['revenue']}. "
    if financials.get("eps_diluted"):
        brief += f"EPS (diluted): ${financials['eps_diluted']}. "
    if financials.get("gross_margin"):
        brief += f"Gross margin: {financials['gross_margin']}."

    result = {
        "ticker":       ticker.upper(),
        "quarter":      quarter,
        "generated_at": datetime.utcnow().isoformat(),
        "sentiment":    sentiment,
        "guidance":     guidance,
        "risk_delta":   risk_delta,
        "financials":   financials,
        "market":       market,
        "brief":        brief,
    }

    save_analysis(result)
    return result


# ── app factory ───────────────────────────────────────────────────────────────

def create_app(testing: bool = False) -> Flask:
    app = Flask(__name__)
    app.config["TESTING"] = testing
    CORS(app)
    init_db()

    # ── health ──────────────────────────────────────────────────────────────
    @app.get("/api/health")
    def health():
        return jsonify({
            "status": "ok",
            "groq": bool(os.environ.get("GROQ_API_KEY")),
            "version": "2.0.0",
        })

    # ── analyze ─────────────────────────────────────────────────────────────
    @app.post("/api/analyze")
    def analyze():
        body = request.get_json(silent=True) or {}
        ticker  = (body.get("ticker") or "").strip().upper()
        quarter = (body.get("quarter") or "").strip()
        if not ticker or not quarter:
            return jsonify({"error": "ticker and quarter are required"}), 400
        try:
            result = _run_analysis(ticker, quarter)
            return jsonify(result)
        except ValueError as e:
            return jsonify({"error": str(e)}), 422
        except Exception as e:
            logger.exception("Analysis failed")
            return jsonify({"error": f"Analysis failed: {e}"}), 500

    # ── compare ─────────────────────────────────────────────────────────────
    @app.post("/api/compare")
    def compare():
        body    = request.get_json(silent=True) or {}
        tickers = [t.strip().upper() for t in body.get("tickers", []) if t.strip()]
        quarter = (body.get("quarter") or "").strip()
        if not tickers or not quarter:
            return jsonify({"error": "tickers (list) and quarter are required"}), 400
        if len(tickers) > 4:
            return jsonify({"error": "Maximum 4 tickers for comparison"}), 400

        results = {}
        errors  = {}
        for ticker in tickers:
            try:
                r = _run_analysis(ticker, quarter)
                results[ticker] = {
                    "sentiment":       r["sentiment"],
                    "guidance_count":  len(r["guidance"]),
                    "optimistic_count":sum(1 for g in r["guidance"] if g["tag"] == "optimistic"),
                    "cautious_count":  sum(1 for g in r["guidance"] if g["tag"] == "cautious"),
                    "risk_added":      len(r["risk_delta"]["added"]),
                    "risk_removed":    len(r["risk_delta"]["removed"]),
                    "financials":      r.get("financials", {}),
                    "market":          r.get("market", {}),
                    "brief":           r["brief"],
                }
            except Exception as e:
                errors[ticker] = str(e)

        return jsonify({"quarter": quarter, "results": results, "errors": errors})

    # ── chat ────────────────────────────────────────────────────────────────
    @app.post("/api/chat")
    def chat():
        body    = request.get_json(silent=True) or {}
        query   = body.get("query")
        if not query:
            return jsonify({"error": "query is required"}), 400

        ticker  = body.get("ticker", "")
        context = body.get("context", "")

        # Enrich with market data if question is market-related
        if ticker and is_market_question(query):
            try:
                snapshot = get_market_snapshot(ticker)
                context  = f"{format_market_context(snapshot)}\n\n{context}"
            except Exception:
                pass

        # Enrich with latest filing brief from DB
        if ticker and not context:
            cached = get_analysis(ticker, "")  # won't work without quarter
            # Try to find latest analysis for this ticker
            history = get_history(limit=50)
            for h in history:
                if h["ticker"] == ticker.upper():
                    full = get_analysis(ticker, h["quarter"])
                    if full:
                        mda_sections = ""
                        # Use brief as context if full filing not available
                        context = full.get("brief", "")
                    break

        result = answer_question(query, context)
        return jsonify(result)

    # ── market ──────────────────────────────────────────────────────────────
    @app.get("/api/market/<ticker>")
    def market(ticker):
        try:
            return jsonify(get_market_snapshot(ticker))
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # ── history ─────────────────────────────────────────────────────────────
    @app.get("/api/history")
    def history():
        limit = min(int(request.args.get("limit", 20)), 100)
        return jsonify({"history": get_history(limit)})

    # ── trend ───────────────────────────────────────────────────────────────
    @app.get("/api/trend/<ticker>")
    def trend(ticker):
        return jsonify({"ticker": ticker.upper(), "trend": get_sentiment_trend(ticker)})

    # ── watchlist ───────────────────────────────────────────────────────────
    @app.get("/api/watchlist")
    def watchlist_get():
        return jsonify({"watchlist": get_watchlist()})

    @app.post("/api/watchlist")
    def watchlist_add():
        body   = request.get_json(silent=True) or {}
        ticker = (body.get("ticker") or "").strip().upper()
        if not ticker:
            return jsonify({"error": "ticker required"}), 400
        add_to_watchlist(ticker)
        return jsonify({"ok": True, "ticker": ticker})

    @app.delete("/api/watchlist/<ticker>")
    def watchlist_remove(ticker):
        remove_from_watchlist(ticker)
        return jsonify({"ok": True})

    return app


if __name__ == "__main__":
    create_app().run(port=5000, debug=True)
