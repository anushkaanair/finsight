"""
SQLite persistence layer for FinSight.
Stores analysis results, watchlist, and sentiment trend history.
DB file: backend/data/finsight.db
"""
from __future__ import annotations
import json
import sqlite3
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent / "data" / "finsight.db"


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(DB_PATH))
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    """Create tables if they don't exist."""
    with _conn() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS analyses (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker          TEXT    NOT NULL,
            quarter         TEXT    NOT NULL,
            generated_at    TEXT    NOT NULL,
            sentiment_label TEXT,
            sentiment_pos   REAL,
            sentiment_neg   REAL,
            sentiment_neu   REAL,
            guidance_count  INTEGER,
            risk_added      INTEGER,
            risk_removed    INTEGER,
            risk_modified   INTEGER,
            brief           TEXT,
            financials_json TEXT,
            full_json       TEXT,
            UNIQUE(ticker, quarter) ON CONFLICT REPLACE
        );

        CREATE TABLE IF NOT EXISTS watchlist (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker   TEXT NOT NULL UNIQUE,
            added_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_analyses_ticker ON analyses(ticker);
        CREATE INDEX IF NOT EXISTS idx_analyses_quarter ON analyses(quarter);
        """)
    logger.info("Database initialised at %s", DB_PATH)


def save_analysis(result: dict) -> None:
    """Persist a full analysis result dict."""
    try:
        sentiment = result.get("sentiment", {})
        score = sentiment.get("score", {})
        risk = result.get("risk_delta", {})

        with _conn() as con:
            con.execute(
                """
                INSERT OR REPLACE INTO analyses
                  (ticker, quarter, generated_at, sentiment_label,
                   sentiment_pos, sentiment_neg, sentiment_neu,
                   guidance_count, risk_added, risk_removed, risk_modified,
                   brief, financials_json, full_json)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    result.get("ticker", "").upper(),
                    result.get("quarter", ""),
                    result.get("generated_at", datetime.utcnow().isoformat()),
                    sentiment.get("label"),
                    score.get("positive"),
                    score.get("negative"),
                    score.get("neutral"),
                    len(result.get("guidance", [])),
                    len(risk.get("added", [])),
                    len(risk.get("removed", [])),
                    len(risk.get("modified", [])),
                    result.get("brief", ""),
                    json.dumps(result.get("financials", {})),
                    json.dumps(result),
                ),
            )
        logger.info("Saved analysis %s %s", result.get("ticker"), result.get("quarter"))
    except Exception as e:
        logger.error("Failed to save analysis: %s", e)


def get_history(limit: int = 20) -> list[dict]:
    """Return recent analyses (summary, not full JSON)."""
    try:
        with _conn() as con:
            rows = con.execute(
                """
                SELECT ticker, quarter, generated_at, sentiment_label,
                       sentiment_pos, sentiment_neg, sentiment_neu,
                       guidance_count, risk_added, risk_removed, brief
                FROM analyses
                ORDER BY generated_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error("get_history failed: %s", e)
        return []


def get_analysis(ticker: str, quarter: str) -> dict | None:
    """Return full cached analysis JSON if it exists."""
    try:
        with _conn() as con:
            row = con.execute(
                "SELECT full_json FROM analyses WHERE ticker=? AND quarter=?",
                (ticker.upper(), quarter),
            ).fetchone()
        if row:
            return json.loads(row["full_json"])
        return None
    except Exception as e:
        logger.error("get_analysis failed: %s", e)
        return None


def get_sentiment_trend(ticker: str) -> list[dict]:
    """Return all sentiment scores for a ticker across quarters (for charting)."""
    try:
        with _conn() as con:
            rows = con.execute(
                """
                SELECT quarter, sentiment_label, sentiment_pos, sentiment_neg, sentiment_neu
                FROM analyses WHERE ticker=?
                ORDER BY quarter ASC
                """,
                (ticker.upper(),),
            ).fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error("get_sentiment_trend failed: %s", e)
        return []


# ── Watchlist ─────────────────────────────────────────────────────────────────

def add_to_watchlist(ticker: str) -> None:
    with _conn() as con:
        con.execute(
            "INSERT OR IGNORE INTO watchlist (ticker, added_at) VALUES (?,?)",
            (ticker.upper(), datetime.utcnow().isoformat()),
        )


def remove_from_watchlist(ticker: str) -> None:
    with _conn() as con:
        con.execute("DELETE FROM watchlist WHERE ticker=?", (ticker.upper(),))


def get_watchlist() -> list[dict]:
    try:
        with _conn() as con:
            rows = con.execute(
                """
                SELECT w.ticker, w.added_at,
                       a.sentiment_label, a.quarter as last_quarter,
                       a.generated_at as last_analyzed
                FROM watchlist w
                LEFT JOIN analyses a ON a.ticker = w.ticker
                  AND a.generated_at = (
                    SELECT MAX(generated_at) FROM analyses WHERE ticker = w.ticker
                  )
                ORDER BY w.added_at DESC
                """,
            ).fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error("get_watchlist failed: %s", e)
        return []
