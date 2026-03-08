import uuid

from flask import Blueprint, request, jsonify

from game.history import read_game_history

admin_bp = Blueprint("admin", __name__)

ADMIN_PASSWORD = "thisisthebestpwd"

# Simple in-memory admin sessions (tokens valid until server restart)
_admin_tokens: set[str] = set()


@admin_bp.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json() or {}
    password = data.get("password", "")

    if password != ADMIN_PASSWORD:
        return jsonify({"error": "Invalid password"}), 401

    token = str(uuid.uuid4())
    _admin_tokens.add(token)

    return jsonify({"token": token}), 200


@admin_bp.route("/api/admin/history", methods=["GET"])
def admin_history():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401

    token = auth[7:]
    if token not in _admin_tokens:
        return jsonify({"error": "Unauthorized"}), 401

    history = read_game_history()
    return jsonify({"games": history}), 200
