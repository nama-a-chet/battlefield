from flask import Blueprint, request, jsonify, Response

from game.models import get_game_and_player, opponent_key
from game.events import push_event, format_sse, create_stream_queue
from game.service import (
    create_new_game,
    join_existing_game,
    sanitize_state,
    place_player_ships,
    fire_player_shot,
    forfeit_game,
    rematch_game,
    handle_disconnect,
)

game_bp = Blueprint("game", __name__)


def _get_token():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


# ── Create Game ──────────────────────────────────────────────

@game_bp.route("/api/games", methods=["POST"])
def create_game_route():
    data = request.get_json() or {}
    player_name = data.get("player_name", "Player 1")
    mode = data.get("mode", "human")

    if mode not in ("human", "ai"):
        return jsonify({"error": "mode must be 'human' or 'ai'"}), 400

    game_id, token, code = create_new_game(player_name, mode)

    return jsonify({
        "game_id": game_id,
        "token": token,
        "code": code,
        "mode": mode,
    }), 201


# ── Join Game ────────────────────────────────────────────────

@game_bp.route("/api/games/join", methods=["POST"])
def join_game_route():
    data = request.get_json() or {}
    code = data.get("code", "").strip().upper()
    player_name = data.get("player_name", "Player 2")

    if not code:
        return jsonify({"error": "code is required"}), 400

    game_id, result = join_existing_game(code, player_name)

    if game_id is None:
        return jsonify({"error": result}), 400

    return jsonify({"game_id": game_id, "token": result}), 200


# ── Get State ────────────────────────────────────────────────

@game_bp.route("/api/games/<game_id>/state", methods=["GET"])
def get_state(game_id):
    token = _get_token() or request.args.get("token")
    if not token:
        return jsonify({"error": "Token required"}), 401

    game, player_key = get_game_and_player(token)
    if not game or game.id != game_id:
        return jsonify({"error": "Game not found"}), 404

    with game.lock:
        state = sanitize_state(game, player_key)

    return jsonify(state), 200


# ── SSE Stream ───────────────────────────────────────────────

@game_bp.route("/api/games/<game_id>/stream", methods=["GET"])
def stream(game_id):
    token = request.args.get("token")
    if not token:
        return jsonify({"error": "Token required"}), 401

    game, player_key = get_game_and_player(token)
    if not game or game.id != game_id:
        return jsonify({"error": "Game not found"}), 404

    q = create_stream_queue()

    with game.lock:
        player = game.get_player(player_key)
        player.stream_queue = q
        player.connected = True

    # Notify opponent of reconnection
    opp_key = opponent_key(player_key)
    opp_player = game.get_player(opp_key)
    if opp_player and opp_player.connected:
        push_event(game, opp_key, "opponent_reconnected", {})

    # Send initial connected event
    push_event(game, player_key, "connected", {
        "player_key": player_key,
        "phase": game.phase,
    })

    def generate():
        try:
            while True:
                try:
                    event = q.get(timeout=30)
                    yield format_sse(event)
                except Exception:
                    # Send heartbeat to keep connection alive
                    yield ": heartbeat\n\n"
        except GeneratorExit:
            handle_disconnect(game, player_key)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── Place Ships ──────────────────────────────────────────────

@game_bp.route("/api/games/<game_id>/place-ships", methods=["POST"])
def place_ships(game_id):
    token = _get_token()
    if not token:
        return jsonify({"error": "Token required"}), 401

    game, player_key = get_game_and_player(token)
    if not game or game.id != game_id:
        return jsonify({"error": "Game not found"}), 404

    data = request.get_json() or {}
    ships_data = data.get("ships")
    if not ships_data:
        return jsonify({"error": "ships data required"}), 400

    success, error = place_player_ships(game, player_key, ships_data)
    if not success:
        return jsonify({"error": error}), 400

    return jsonify({"ok": True}), 200


# ── Fire Shot ────────────────────────────────────────────────

@game_bp.route("/api/games/<game_id>/fire", methods=["POST"])
def fire(game_id):
    token = _get_token()
    if not token:
        return jsonify({"error": "Token required"}), 401

    game, player_key = get_game_and_player(token)
    if not game or game.id != game_id:
        return jsonify({"error": "Game not found"}), 404

    data = request.get_json() or {}
    row = data.get("row")
    col = data.get("col")

    if row is None or col is None:
        return jsonify({"error": "row and col required"}), 400

    result, error = fire_player_shot(game, player_key, row, col)
    if error:
        return jsonify({"error": error}), 400

    return jsonify(result), 200


# ── Forfeit ──────────────────────────────────────────────────

@game_bp.route("/api/games/<game_id>", methods=["DELETE"])
def forfeit(game_id):
    token = _get_token()
    if not token:
        return jsonify({"error": "Token required"}), 401

    game, player_key = get_game_and_player(token)
    if not game or game.id != game_id:
        return jsonify({"error": "Game not found"}), 404

    success, error = forfeit_game(game, player_key)
    if not success:
        return jsonify({"error": error}), 400

    return jsonify({"ok": True}), 200


# ── Rematch ──────────────────────────────────────────────────

@game_bp.route("/api/games/<game_id>/rematch", methods=["POST"])
def rematch(game_id):
    token = _get_token()
    if not token:
        return jsonify({"error": "Token required"}), 401

    game, player_key = get_game_and_player(token)
    if not game or game.id != game_id:
        return jsonify({"error": "Game not found"}), 404

    success, error = rematch_game(game)
    if not success:
        return jsonify({"error": error}), 400

    return jsonify({"ok": True}), 200
