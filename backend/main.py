import logging
import os
import time
import threading

from flask import Flask, jsonify
from flask_cors import CORS

from setup.config import CLEANUP_INTERVAL_SECONDS, GAME_INACTIVE_TIMEOUT_SECONDS
from game.store import games, player_tokens, game_codes, store_lock
from request_handlers.game_routes import game_bp

# ── Logging ──────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ──────────────────────────────────────────────────────

app = Flask(__name__)

cors_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:8100").split(",")
CORS(app, origins=cors_origins)

app.register_blueprint(game_bp)


@app.errorhandler(Exception)
def handle_exception(e):
    logger.exception("Unhandled exception")
    return jsonify({"error": "Internal server error"}), 500


@app.route("/health")
def health():
    with store_lock:
        active_games = len(games)
    return {"status": "ok", "active_games": active_games}


# ── Cleanup ──────────────────────────────────────────────────

def cleanup_stale_games():
    """Remove games inactive for >30 minutes. Runs as a daemon thread."""
    while True:
        time.sleep(CLEANUP_INTERVAL_SECONDS)
        try:
            now = time.time()
            to_remove = []

            with store_lock:
                for game_id, game in games.items():
                    if now - game.last_activity > GAME_INACTIVE_TIMEOUT_SECONDS:
                        to_remove.append(game_id)

                for game_id in to_remove:
                    game = games.pop(game_id, None)
                    if game and game.code in game_codes:
                        del game_codes[game.code]

                    # Clean up player tokens pointing to this game
                    stale_tokens = [
                        t for t, info in player_tokens.items()
                        if info["game_id"] == game_id
                    ]
                    for t in stale_tokens:
                        del player_tokens[t]

            if to_remove:
                logger.info("Removed %d stale game(s)", len(to_remove))

        except Exception:
            logger.exception("Error during game cleanup")


cleanup_thread = threading.Thread(target=cleanup_stale_games, daemon=True)
cleanup_thread.start()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8084))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
