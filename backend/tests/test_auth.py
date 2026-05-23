"""
Tests for JWT auth endpoints:
  POST /api/auth/register
  POST /api/auth/login
  POST /api/auth/refresh
  GET  /api/auth/me
  GET  /api/health  (public — no token needed)
  POST /api/analyze (protected — needs token)
"""
import os
import tempfile
import pytest
import db as _db_module
from app import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    """
    Each test gets a fresh SQLite database by temporarily redirecting DB_PATH.
    """
    test_db = tmp_path / "test_finsight.db"
    monkeypatch.setattr(_db_module, "DB_PATH", test_db)

    app = create_app(testing=True)
    app.config["JWT_SECRET_KEY"] = "test-secret-key-32-bytes-long-xx"
    with app.test_client() as c:
        yield c


# ── helpers ────────────────────────────────────────────────────────────────────

def _register(client, email="test@example.com", username="testuser", password="password123"):
    return client.post("/api/auth/register", json={
        "email": email,
        "username": username,
        "password": password,
    })


def _login(client, email="test@example.com", password="password123"):
    return client.post("/api/auth/login", json={
        "email": email,
        "password": password,
    })


# ── public endpoints ───────────────────────────────────────────────────────────

def test_health_is_public(client):
    rv = client.get("/api/health")
    assert rv.status_code == 200
    data = rv.get_json()
    assert data["status"] == "ok"


# ── register ───────────────────────────────────────────────────────────────────

def test_register_success(client):
    rv = _register(client)
    assert rv.status_code == 201
    data = rv.get_json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "test@example.com"
    assert data["user"]["username"] == "testuser"


def test_register_missing_fields(client):
    rv = client.post("/api/auth/register", json={"email": "x@x.com"})
    assert rv.status_code == 422
    assert "error" in rv.get_json()


def test_register_invalid_email(client):
    rv = _register(client, email="not-an-email")
    assert rv.status_code == 422
    data = rv.get_json()
    assert any("email" in e.lower() for e in data.get("errors", [data.get("error", "")]))


def test_register_short_password(client):
    rv = _register(client, password="short")
    assert rv.status_code == 422


def test_register_duplicate_email(client):
    _register(client)  # first registration
    rv = _register(client)  # same email
    assert rv.status_code == 409
    assert "already" in rv.get_json()["error"].lower()


def test_register_invalid_username(client):
    rv = _register(client, username="u!")  # too short + invalid char
    assert rv.status_code == 422


# ── login ──────────────────────────────────────────────────────────────────────

def test_login_success(client):
    _register(client)
    rv = _login(client)
    assert rv.status_code == 200
    data = rv.get_json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password(client):
    _register(client)
    rv = _login(client, password="wrongpassword")
    assert rv.status_code == 401


def test_login_unknown_email(client):
    rv = _login(client, email="nobody@example.com")
    assert rv.status_code == 401


def test_login_missing_fields(client):
    rv = client.post("/api/auth/login", json={"email": "test@example.com"})
    assert rv.status_code == 422


# ── /me ────────────────────────────────────────────────────────────────────────

def test_me_authenticated(client):
    _register(client)
    login_rv = _login(client)
    token = login_rv.get_json()["access_token"]

    rv = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert rv.status_code == 200
    data = rv.get_json()
    assert data["user"]["email"] == "test@example.com"


def test_me_unauthenticated(client):
    rv = client.get("/api/auth/me")
    assert rv.status_code == 401


# ── refresh ────────────────────────────────────────────────────────────────────

def test_refresh_token(client):
    _register(client)
    login_rv = _login(client)
    refresh_token = login_rv.get_json()["refresh_token"]

    rv = client.post(
        "/api/auth/refresh",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert rv.status_code == 200
    assert "access_token" in rv.get_json()


def test_refresh_with_access_token_fails(client):
    """Access tokens cannot be used on the refresh endpoint."""
    _register(client)
    login_rv = _login(client)
    access_token = login_rv.get_json()["access_token"]

    rv = client.post(
        "/api/auth/refresh",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert rv.status_code in (401, 422)  # flask-jwt-extended rejects non-refresh tokens


# ── protected endpoint guard ──────────────────────────────────────────────────

def test_analyze_requires_auth(client):
    rv = client.post("/api/analyze", json={"ticker": "AAPL", "quarter": "Q1-2024"})
    assert rv.status_code == 401


def test_analyze_with_valid_token_passes_auth(client):
    """
    Only checks that auth is accepted (analysis itself will fail without EDGAR
    network access in the test environment — that's expected).
    """
    _register(client)
    login_rv = _login(client)
    token = login_rv.get_json()["access_token"]

    rv = client.post(
        "/api/analyze",
        json={"ticker": "AAPL", "quarter": "Q1-2024"},
        headers={"Authorization": f"Bearer {token}"},
    )
    # 200 (cached), 422 (parse issue), or 500 (network) — but NOT 401
    assert rv.status_code != 401
