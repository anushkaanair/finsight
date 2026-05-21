"""
FinSight — Auth Blueprint
=========================
Endpoints:
  POST /api/auth/register   — create account  { email, username, password }
  POST /api/auth/login      — get JWT tokens   { email, password }
  POST /api/auth/refresh    — refresh access token (send refresh token in header)
  GET  /api/auth/me         — current user info (requires access token)
  POST /api/auth/logout     — client-side logout hint (token must be discarded client-side)
"""
from __future__ import annotations

import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
)
from werkzeug.security import check_password_hash, generate_password_hash

from db import create_user, get_user_by_email, get_user_by_id

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# ── validation helpers ────────────────────────────────────────────────────────

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,32}$")

MIN_PASSWORD_LEN = 8


def _validate_register(body: dict) -> list[str]:
    """Return a list of validation error strings (empty = valid)."""
    errors: list[str] = []

    email = (body.get("email") or "").strip()
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    if not email:
        errors.append("Email is required.")
    elif not _EMAIL_RE.match(email):
        errors.append("Email is not valid.")

    if not username:
        errors.append("Username is required.")
    elif not _USERNAME_RE.match(username):
        errors.append(
            "Username must be 3–32 characters and contain only letters, digits, "
            "underscores, dots, or hyphens."
        )

    if not password:
        errors.append("Password is required.")
    elif len(password) < MIN_PASSWORD_LEN:
        errors.append(f"Password must be at least {MIN_PASSWORD_LEN} characters.")

    return errors


# ── routes ────────────────────────────────────────────────────────────────────

@auth_bp.post("/register")
def register():
    """
    Register a new FinSight analyst account.

    Request body (JSON):
      { "email": "...", "username": "...", "password": "..." }

    Returns 201 with access + refresh tokens on success.
    """
    body = request.get_json(silent=True) or {}
    errors = _validate_register(body)
    if errors:
        return jsonify({"error": errors[0], "errors": errors}), 422

    email    = body["email"].strip().lower()
    username = body["username"].strip()
    password = body["password"]

    pw_hash = generate_password_hash(password)

    try:
        user = create_user(email=email, username=username, password_hash=pw_hash)
    except ValueError as e:
        return jsonify({"error": str(e)}), 409  # conflict (duplicate email/username)

    # Issue tokens immediately so the user is logged in right after registering
    access_token  = create_access_token(identity=str(user["id"]))
    refresh_token = create_refresh_token(identity=str(user["id"]))

    return jsonify({
        "message":       "Account created successfully.",
        "user":          {"id": user["id"], "email": user["email"], "username": user["username"]},
        "access_token":  access_token,
        "refresh_token": refresh_token,
    }), 201


@auth_bp.post("/login")
def login():
    """
    Authenticate and receive JWT tokens.

    Request body (JSON):
      { "email": "...", "password": "..." }

    Returns access_token (short-lived, 1 h) and refresh_token (7 days).
    """
    body     = request.get_json(silent=True) or {}
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 422

    user = get_user_by_email(email)
    if not user:
        return jsonify({"error": "Invalid email or password."}), 401

    if not user.get("is_active", 1):
        return jsonify({"error": "Account is disabled. Contact support."}), 403

    if not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password."}), 401

    access_token  = create_access_token(identity=str(user["id"]))
    refresh_token = create_refresh_token(identity=str(user["id"]))

    return jsonify({
        "message":       "Login successful.",
        "user":          {"id": user["id"], "email": user["email"], "username": user["username"]},
        "access_token":  access_token,
        "refresh_token": refresh_token,
    })


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    """
    Obtain a new access token using a valid refresh token.
    Send the refresh token as:  Authorization: Bearer <refresh_token>
    """
    uid = get_jwt_identity()
    new_access_token = create_access_token(identity=uid)
    return jsonify({"access_token": new_access_token})


@auth_bp.get("/me")
@jwt_required()
def me():
    """Return the currently authenticated user's profile."""
    uid = int(get_jwt_identity())
    user = get_user_by_id(uid)
    if not user:
        return jsonify({"error": "User not found."}), 404
    return jsonify({"user": user})


@auth_bp.post("/logout")
@jwt_required()
def logout():
    """
    Logout hint — tokens are stateless so the client must discard them.
    A production system would add the JTI to a denylist (Redis).
    """
    return jsonify({"message": "Logged out. Please discard your tokens client-side."})
