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
            health_score    INTEGER,
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

        CREATE TABLE IF NOT EXISTS credibility (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker               TEXT NOT NULL,
            quarter              TEXT NOT NULL,
            prev_quarter         TEXT,
            prev_optimism_ratio  REAL,
            actual_sentiment_pos REAL,
            credibility_delta    REAL,
            UNIQUE(ticker, quarter) ON CONFLICT REPLACE
        );

        CREATE INDEX IF NOT EXISTS idx_cred_ticker ON credibility(ticker);

        CREATE TABLE IF NOT EXISTS users (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            email        TEXT    NOT NULL UNIQUE,
            username     TEXT    NOT NULL UNIQUE,
            password_hash TEXT   NOT NULL,
            created_at   TEXT    NOT NULL,
            is_active    INTEGER NOT NULL DEFAULT 1
        );

        CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        """)
    # Migrate: add health_score column if it doesn't exist (added in v2.1)
    try:
        with _conn() as con:
            con.execute("ALTER TABLE analyses ADD COLUMN health_score INTEGER")
        logger.info("Migration: added health_score column to analyses")
    except Exception:
        pass  # column already exists — safe to ignore

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
                   health_score, brief, financials_json, full_json)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
                    result.get("health_score"),
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


def get_quarters(ticker: str) -> list[dict]:
    """Return all analysed quarters for a ticker, most recent first."""
    try:
        with _conn() as con:
            rows = con.execute(
                """
                SELECT quarter, generated_at, sentiment_label, health_score
                FROM analyses WHERE ticker=?
                ORDER BY quarter DESC
                """,
                (ticker.upper(),),
            ).fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error("get_quarters failed: %s", e)
        return []


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


# ── Credibility ───────────────────────────────────────────────────────────────

def save_credibility(
    ticker: str,
    quarter: str,
    prev_quarter: str | None,
    prev_optimism_ratio: float | None,
    actual_sentiment_pos: float,
    credibility_delta: float | None,
) -> None:
    try:
        with _conn() as con:
            con.execute(
                """
                INSERT OR REPLACE INTO credibility
                  (ticker, quarter, prev_quarter, prev_optimism_ratio,
                   actual_sentiment_pos, credibility_delta)
                VALUES (?,?,?,?,?,?)
                """,
                (
                    ticker.upper(), quarter, prev_quarter,
                    prev_optimism_ratio, actual_sentiment_pos, credibility_delta,
                ),
            )
    except Exception as e:
        logger.error("save_credibility failed: %s", e)


def get_credibility(ticker: str) -> list[dict]:
    try:
        with _conn() as con:
            rows = con.execute(
                """
                SELECT quarter, prev_quarter, prev_optimism_ratio,
                       actual_sentiment_pos, credibility_delta
                FROM credibility WHERE ticker=?
                ORDER BY quarter ASC
                """,
                (ticker.upper(),),
            ).fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error("get_credibility failed: %s", e)
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


# ── Users ─────────────────────────────────────────────────────────────────────

def create_user(email: str, username: str, password_hash: str) -> dict:
    """
    Insert a new user. Raises ValueError on duplicate email/username.
    Returns the created user row (without password_hash).
    """
    from datetime import datetime as _dt
    created_at = _dt.utcnow().isoformat()
    try:
        with _conn() as con:
            cur = con.execute(
                """
                INSERT INTO users (email, username, password_hash, created_at)
                VALUES (?,?,?,?)
                """,
                (email.lower(), username, password_hash, created_at),
            )
            uid = cur.lastrowid
        return {"id": uid, "email": email.lower(), "username": username, "created_at": created_at}
    except sqlite3.IntegrityError as e:
        msg = str(e).lower()
        if "email" in msg:
            raise ValueError("Email already registered.")
        raise ValueError("Username already taken.")


def get_user_by_email(email: str) -> dict | None:
    """Return user row (including password_hash) by email, or None."""
    try:
        with _conn() as con:
            row = con.execute(
                "SELECT id, email, username, password_hash, created_at, is_active FROM users WHERE email=?",
                (email.lower(),),
            ).fetchone()
        return dict(row) if row else None
    except Exception as e:
        logger.error("get_user_by_email failed: %s", e)
        return None


def get_user_by_id(uid: int) -> dict | None:
    """Return user row (without password_hash) by id, or None."""
    try:
        with _conn() as con:
            row = con.execute(
                "SELECT id, email, username, created_at, is_active FROM users WHERE id=?",
                (uid,),
            ).fetchone()
        return dict(row) if row else None
    except Exception as e:
        logger.error("get_user_by_id failed: %s", e)
        return None


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
