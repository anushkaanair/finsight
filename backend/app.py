"""
FinSight Flask API
Endpoints:
  GET  /api/health
  POST /api/analyze              — full SEC filing analysis
  POST /api/upload               — analyze an uploaded PDF/Excel/CSV/TXT file
  POST /api/compare              — side-by-side multi-ticker comparison
  POST /api/chat                 — Groq RAG chat
  GET  /api/market/<ticker>      — live yfinance data
  GET  /api/history              — recent analyses from SQLite
  GET  /api/quarters/<ticker>    — list analysed quarters for a ticker
  GET  /api/trend/<ticker>       — sentiment trend across quarters
  GET  /api/credibility/<ticker> — management credibility score across quarters
  GET  /api/portfolio            — watchlist ranked by health score + allocation signals
  GET  /api/export/<ticker>/<q>  — download PDF report for a ticker/quarter
  GET  /api/watchlist            — get watchlist
  POST /api/watchlist            — add to watchlist
  DELETE /api/watchlist/<t>      — remove from watchlist
"""
from __future__ import annotations
import logging
import os
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Load .env from backend directory
load_dotenv(Path(__file__).parent / ".env")

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required

from auth import auth_bp
from chat.engine import answer_question, generate_brief
from chat.market import get_market_snapshot, is_market_question, format_market_context
from ingestion.edgar_client import get_cik, download_filing
from ingestion.parser import extract_sections
from analysis.sentiment import score_mda
from analysis.risk_delta import compute_risk_delta
from analysis.guidance import extract_guidance
from analysis.financials import extract_financials
from rag.indexer import build_index, retrieve, index_dir_for
from db import (
    init_db, save_analysis, get_history, get_analysis,
    get_quarters, get_sentiment_trend,
    save_credibility, get_credibility,
    add_to_watchlist, remove_from_watchlist, get_watchlist,
)
from analysis.credibility import compute_credibility_delta, credibility_summary

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _extract_text_from_upload(file_obj, filename: str) -> str:
    """
    Extract plain text from an uploaded file.
    Supports: PDF, Excel (.xlsx/.xls), CSV, plain text (.txt/.doc).
    Raises ValueError for unsupported formats.
    """
    if filename.endswith(".pdf"):
        try:
            from pdfminer.high_level import extract_text as pdf_extract_text  # type: ignore
            import io
            return pdf_extract_text(io.BytesIO(file_obj.read()))
        except ImportError:
            raise ValueError(
                "PDF parsing requires pdfminer.six. "
                "Install it: pip install pdfminer.six"
            )

    if filename.endswith((".xlsx", ".xls")):
        try:
            import openpyxl  # type: ignore
            import io
            wb = openpyxl.load_workbook(io.BytesIO(file_obj.read()), read_only=True, data_only=True)
            lines = []
            for sheet in wb.worksheets:
                for row in sheet.iter_rows(values_only=True):
                    line = " ".join(str(c) for c in row if c is not None)
                    if line.strip():
                        lines.append(line)
            return "\n".join(lines)
        except ImportError:
            raise ValueError(
                "Excel parsing requires openpyxl. "
                "Install it: pip install openpyxl"
            )

    if filename.endswith(".csv"):
        import io
        import csv as csv_mod
        content = file_obj.read().decode("utf-8", errors="replace")
        reader = csv_mod.reader(io.StringIO(content))
        return "\n".join(" ".join(row) for row in reader)

    if filename.endswith((".txt", ".doc", ".text", "")):
        return file_obj.read().decode("utf-8", errors="replace")

    # Fallback: try to decode as text anyway
    try:
        return file_obj.read().decode("utf-8", errors="replace")
    except Exception:
        raise ValueError(
            f"Unsupported file format '{filename}'. "
            "Supported: PDF, XLSX, XLS, CSV, TXT"
        )


# ── helpers ───────────────────────────────────────────────────────────────────

def _compute_health_score(sentiment: dict, guidance: list, risk_delta: dict, financials: dict) -> int:
    """
    Compute a 0-100 filing health score from structured analysis outputs.

    Breakdown:
      - Sentiment   (0–40): based on positive% from FinBERT
      - Guidance    (0–30): ratio of optimistic to total guidance signals
      - Risk delta  (0–20): starts at 20, -4 per new risk added, +2 per removed
      - Financials  (0–10): 10 if revenue/EPS available, 5 if partial, 0 if none
    """
    # Sentiment component (0–40)
    pos = sentiment.get("score", {}).get("positive", 0.0)
    sentiment_pts = round(pos * 40)

    # Guidance component (0–30)
    opt = sum(1 for g in guidance if g.get("tag") == "optimistic")
    caut = sum(1 for g in guidance if g.get("tag") == "cautious")
    total_guidance = opt + caut
    if total_guidance > 0:
        guidance_pts = round((opt / total_guidance) * 30)
    else:
        guidance_pts = 15  # neutral when no signals

    # Risk delta component (0–20)
    new_risks = len(risk_delta.get("added", []))
    removed_risks = len(risk_delta.get("removed", []))
    risk_pts = max(0, min(20, 20 - (new_risks * 4) + (removed_risks * 2)))

    # Financials completeness component (0–10)
    fin_keys = {"revenue", "eps_diluted", "gross_profit", "net_income"}
    present = sum(1 for k in fin_keys if financials.get(k))
    if present >= 3:
        fin_pts = 10
    elif present >= 1:
        fin_pts = 5
    else:
        fin_pts = 0

    score = sentiment_pts + guidance_pts + risk_pts + fin_pts
    return max(0, min(100, score))


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

    # 7. Build FAISS vector index over MD&A + Risk Factors for RAG chat
    corpus = "\n\n".join(filter(None, [mda_text, risk_text]))
    idx_dir = index_dir_for(ticker, quarter)
    try:
        build_index(corpus, idx_dir)
        logger.info("FAISS index built/loaded for %s %s at %s", ticker, quarter, idx_dir)
    except Exception as e:
        logger.warning("FAISS index build failed (RAG will fall back to brief): %s", e)

    # 8. Live market data
    market = {}
    try:
        market = get_market_snapshot(ticker)
    except Exception:
        pass

    # 9. Generate analyst brief via Groq (falls back to template if no API key)
    brief = generate_brief(
        ticker=ticker,
        quarter=quarter,
        sentiment=sentiment,
        guidance=guidance,
        risk_delta=risk_delta,
        financials=financials,
        mda_snippet=mda_text[:1500] if mda_text else "",
    )

    health_score = _compute_health_score(sentiment, guidance, risk_delta, financials)

    # ── Credibility tracking ──────────────────────────────────────────────
    # Compare this quarter's actual sentiment against last quarter's guidance tone.
    credibility_delta = None
    prev_optimism_ratio = None
    try:
        prev_result = get_analysis(ticker, prev_q)
        if prev_result:
            prev_guidance = prev_result.get("guidance", [])
            opt  = sum(1 for g in prev_guidance if g.get("tag") == "optimistic")
            caut = sum(1 for g in prev_guidance if g.get("tag") == "cautious")
            total_prev = opt + caut
            if total_prev > 0:
                prev_optimism_ratio = round(opt / total_prev, 3)
            credibility_delta = compute_credibility_delta(prev_guidance, sentiment)
            # save_credibility expects a plain float, not the full dict
            cred_delta_float = (
                credibility_delta.get("delta")
                if isinstance(credibility_delta, dict)
                else credibility_delta
            )
            save_credibility(
                ticker=ticker,
                quarter=quarter,
                prev_quarter=prev_q,
                prev_optimism_ratio=prev_optimism_ratio,
                actual_sentiment_pos=round(sentiment["score"].get("positive", 0), 3),
                credibility_delta=cred_delta_float,
            )
            logger.info(
                "Credibility delta for %s %s: %s", ticker, quarter, credibility_delta
            )
    except Exception as e:
        logger.warning("Credibility computation skipped: %s", e)

    result = {
        "ticker":             ticker.upper(),
        "quarter":            quarter,
        "generated_at":       datetime.utcnow().isoformat(),
        "sentiment":          sentiment,
        "guidance":           guidance,
        "risk_delta":         risk_delta,
        "financials":         financials,
        "market":             market,
        "brief":              brief,
        "health_score":       health_score,
        "credibility_delta":  credibility_delta,
    }

    save_analysis(result)
    return result


# ── app factory ───────────────────────────────────────────────────────────────

def create_app(testing: bool = False) -> Flask:
    app = Flask(__name__)
    app.config["TESTING"] = testing

    # ── JWT configuration ────────────────────────────────────────────────────
    # JWT_SECRET_KEY must be set in .env for production.
    # Falls back to a random key in development (tokens reset on each restart).
    import secrets
    app.config["JWT_SECRET_KEY"] = os.environ.get(
        "JWT_SECRET_KEY", secrets.token_hex(32)
    )
    # Access tokens expire in 1 hour; refresh tokens last 7 days.
    from datetime import timedelta
    app.config["JWT_ACCESS_TOKEN_EXPIRES"]  = timedelta(hours=1)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=7)

    jwt = JWTManager(app)

    @jwt.invalid_token_loader
    def invalid_token_callback(reason):
        return jsonify({"error": f"Invalid token: {reason}"}), 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({"error": "Token has expired. Please log in again."}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(reason):
        return jsonify({"error": "Authentication required. Please log in."}), 401

    CORS(app)
    init_db()

    # ── register auth blueprint ──────────────────────────────────────────────
    app.register_blueprint(auth_bp)

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
    @jwt_required()
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

    # ── upload ──────────────────────────────────────────────────────────────
    @app.post("/api/upload")
    @jwt_required()
    def upload():
        """
        Accept a PDF, Excel, CSV, or plain-text 10-Q/10-K file and run
        the analysis pipeline on its extracted text.

        Form fields:
          file    — the uploaded file (multipart)
          ticker  — optional ticker symbol to tag the result (default: "UPLOAD")
          quarter — optional quarter label (default: "UPLOAD")
        """
        if "file" not in request.files:
            return jsonify({"error": "No file provided. Send multipart/form-data with 'file' field."}), 400

        f = request.files["file"]
        ticker  = (request.form.get("ticker")  or "UPLOAD").strip().upper()
        quarter = (request.form.get("quarter") or "UPLOAD").strip()
        filename = (f.filename or "").lower()

        try:
            raw_text = _extract_text_from_upload(f, filename)
        except ValueError as e:
            return jsonify({"error": str(e)}), 422
        except Exception as e:
            logger.exception("File text extraction failed")
            return jsonify({"error": f"Could not read file: {e}"}), 500

        if not raw_text.strip():
            return jsonify({"error": "Extracted text is empty — check that the file contains readable text."}), 422

        try:
            # Run the analysis pipeline on the extracted text (no EDGAR download)
            sentiment  = score_mda(raw_text[:50_000])
            guidance   = extract_guidance(raw_text[:50_000])
            risk_delta = {"added": [], "removed": [], "modified": []}
            financials = {"available": False}  # no HTML tables in plain text

            idx_dir = index_dir_for(ticker, quarter)
            try:
                build_index(raw_text, idx_dir)
            except Exception as e:
                logger.warning("FAISS index build failed for upload: %s", e)

            market = {}
            if ticker != "UPLOAD":
                try:
                    market = get_market_snapshot(ticker)
                except Exception:
                    pass

            brief = generate_brief(
                ticker=ticker, quarter=quarter, sentiment=sentiment,
                guidance=guidance, risk_delta=risk_delta, financials=financials,
                mda_snippet=raw_text[:1500],
            )
            health_score = _compute_health_score(sentiment, guidance, risk_delta, financials)

            result = {
                "ticker":       ticker,
                "quarter":      quarter,
                "generated_at": datetime.utcnow().isoformat(),
                "source":       "upload",
                "filename":     f.filename,
                "sentiment":    sentiment,
                "guidance":     guidance,
                "risk_delta":   risk_delta,
                "financials":   financials,
                "market":       market,
                "brief":        brief,
                "health_score": health_score,
            }
            save_analysis(result)
            return jsonify(result)

        except Exception as e:
            logger.exception("Upload analysis failed")
            return jsonify({"error": f"Analysis failed: {e}"}), 500

    # ── compare ─────────────────────────────────────────────────────────────
    @app.post("/api/compare")
    @jwt_required()
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
    @jwt_required()
    def chat():
        body    = request.get_json(silent=True) or {}
        query   = body.get("query")
        if not query:
            return jsonify({"error": "query is required"}), 400

        ticker  = body.get("ticker", "")
        quarter = body.get("quarter", "")
        context = body.get("context", "")
        rag_sources: list[str] = []

        # ── Step 1: FAISS semantic retrieval ──────────────────────────────
        # Try to load the FAISS index for this ticker/quarter and retrieve
        # the most relevant chunks from the actual filing text.
        if ticker:
            # Resolve quarter: use provided quarter, or find the latest cached one
            resolved_quarter = quarter
            if not resolved_quarter:
                history = get_history(limit=50)
                for h in history:
                    if h["ticker"] == ticker.upper():
                        resolved_quarter = h["quarter"]
                        break

            if resolved_quarter:
                idx_dir = index_dir_for(ticker, resolved_quarter)
                try:
                    rag_sources = retrieve(query, idx_dir, top_k=5)
                    if rag_sources:
                        context = "\n\n---\n\n".join(rag_sources)
                        logger.info(
                            "RAG: retrieved %d chunks for %s %s",
                            len(rag_sources), ticker, resolved_quarter,
                        )
                except Exception as e:
                    logger.warning("RAG retrieval failed: %s", e)

        # ── Step 2: Fallback — use brief from DB if RAG returned nothing ──
        if ticker and not context:
            history = get_history(limit=50)
            for h in history:
                if h["ticker"] == ticker.upper():
                    full = get_analysis(ticker, h["quarter"])
                    if full:
                        context = full.get("brief", "")
                    break

        # ── Step 3: Enrich with live market data if relevant ──────────────
        if ticker and is_market_question(query):
            try:
                snapshot = get_market_snapshot(ticker)
                context  = f"{format_market_context(snapshot)}\n\n{context}"
            except Exception:
                pass

        result = answer_question(query, context, sources=rag_sources or None)
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

    # ── quarters ────────────────────────────────────────────────────────────
    @app.get("/api/quarters/<ticker>")
    def quarters(ticker):
        """List all quarters that have been analysed for a given ticker."""
        return jsonify({
            "ticker": ticker.upper(),
            "quarters": get_quarters(ticker),
        })

    # ── trend ───────────────────────────────────────────────────────────────
    @app.get("/api/trend/<ticker>")
    def trend(ticker):
        return jsonify({"ticker": ticker.upper(), "trend": get_sentiment_trend(ticker)})

    # ── credibility ─────────────────────────────────────────────────────────
    @app.get("/api/credibility/<ticker>")
    def credibility(ticker):
        """
        Return management credibility score for a ticker across all analysed quarters.
        Credibility = how well management's guidance tone predicted actual outcomes.
        """
        history = get_credibility(ticker)
        summary = credibility_summary(history)
        return jsonify({"ticker": ticker.upper(), **summary})

    # ── portfolio ────────────────────────────────────────────────────────────
    @app.get("/api/portfolio")
    def portfolio():
        """
        Rank all watchlist tickers by filing health score and assign allocation signals.

        Signal logic:
          Overweight  — score >= 65 and trending up (or score >= 80)
          Neutral     — score 45-64, or score >= 65 but flat/deteriorating
          Underweight — score < 45, or score >= 45 but sharply deteriorating
        """
        watchlist = get_watchlist()
        ranked = []

        for entry in watchlist:
            t = entry["ticker"]
            trend_data = get_sentiment_trend(t)          # all quarters, asc
            health_history = get_quarters(t)             # all quarters, desc

            latest_score = None
            prev_score   = None
            latest_q     = None

            if health_history:
                latest_score = health_history[0].get("health_score")
                latest_q     = health_history[0].get("quarter")
            if len(health_history) >= 2:
                prev_score = health_history[1].get("health_score")

            # Determine trend direction from health scores
            if latest_score is not None and prev_score is not None:
                diff = latest_score - prev_score
                score_trend = "improving" if diff > 2 else "deteriorating" if diff < -2 else "stable"
            else:
                score_trend = "insufficient data"

            # Sentiment direction from last 2 quarters
            sentiment_trend = None
            if len(trend_data) >= 2:
                curr_pos = trend_data[-1].get("sentiment_pos", 0) or 0
                prev_pos = trend_data[-2].get("sentiment_pos", 0) or 0
                sentiment_trend = "up" if curr_pos > prev_pos + 0.03 else \
                                  "down" if curr_pos < prev_pos - 0.03 else "flat"

            # Allocation signal
            if latest_score is None:
                signal = "No Data"
                signal_color = "neutral"
            elif latest_score >= 65 and score_trend in ("improving", "stable"):
                signal = "Overweight"
                signal_color = "positive"
            elif latest_score >= 80:
                signal = "Overweight"
                signal_color = "positive"
            elif latest_score < 45 or score_trend == "deteriorating" and latest_score < 60:
                signal = "Underweight"
                signal_color = "negative"
            else:
                signal = "Neutral"
                signal_color = "neutral"

            # Credibility summary
            cred_history = get_credibility(t)
            cred = credibility_summary(cred_history)

            ranked.append({
                "ticker":            t,
                "latest_quarter":    latest_q,
                "health_score":      latest_score,
                "score_trend":       score_trend,
                "sentiment_trend":   sentiment_trend,
                "signal":            signal,
                "signal_color":      signal_color,
                "credibility_score": cred.get("score"),
                "credibility_rating":cred.get("rating"),
                "quarters_analysed": len(health_history),
            })

        # Sort: Overweight first, then by health score descending
        signal_order = {"Overweight": 0, "Neutral": 1, "Underweight": 2, "No Data": 3}
        ranked.sort(key=lambda x: (
            signal_order.get(x["signal"], 3),
            -(x["health_score"] or 0),
        ))

        return jsonify({"portfolio": ranked, "count": len(ranked)})

    # ── PDF export ───────────────────────────────────────────────────────────
    @app.get("/api/export/<ticker>/<quarter>")
    @jwt_required()
    def export_pdf(ticker, quarter):
        """
        Generate and stream a PDF analyst report for a previously analysed ticker/quarter.
        """
        from reporting.pdf_export import export_pdf as _make_pdf
        import tempfile, os
        from flask import send_file

        result = get_analysis(ticker.upper(), quarter)
        if not result:
            return jsonify({"error": f"No analysis found for {ticker} {quarter}. Run /api/analyze first."}), 404

        try:
            with tempfile.NamedTemporaryFile(
                suffix=f"_{ticker}_{quarter}_finsight.pdf", delete=False
            ) as tmp:
                tmp_path = tmp.name

            _make_pdf(result, output_path=tmp_path)

            return send_file(
                tmp_path,
                mimetype="application/pdf",
                as_attachment=True,
                download_name=f"{ticker.upper()}_{quarter}_FinSight.pdf",
            )
        except Exception as e:
            logger.exception("PDF export failed")
            return jsonify({"error": f"PDF generation failed: {e}"}), 500
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

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
