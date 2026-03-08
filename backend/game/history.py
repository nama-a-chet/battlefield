import json
import logging
import os
import time
from datetime import datetime, timezone
from threading import Lock

from setup.config import GRID_SIZE

logger = logging.getLogger(__name__)

HISTORY_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
HISTORY_FILE = os.path.join(HISTORY_DIR, "game_history.jsonl")

_file_lock = Lock()


def _count_shots(player):
    """Count hits and misses from a player's shots grid."""
    hits = 0
    misses = 0
    for r in range(GRID_SIZE):
        for c in range(GRID_SIZE):
            cell = player.shots[r][c]
            if cell == "hit":
                hits += 1
            elif cell == "miss":
                misses += 1
    return {"hits": hits, "misses": misses, "total": hits + misses}


def log_game_completion(game, reason: str):
    """Append a completed game record to the history file."""
    try:
        now = time.time()
        p1 = game.player1
        p2 = game.player2

        winner_key = game.winner
        winner_name = None
        if winner_key and game.get_player(winner_key):
            winner_name = game.get_player(winner_key).name

        record = {
            "game_id": game.id,
            "code": game.code,
            "mode": game.mode,
            "player1_name": p1.name if p1 else "Unknown",
            "player2_name": p2.name if p2 else "Unknown",
            "winner_key": winner_key,
            "winner_name": winner_name,
            "reason": reason,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": round(now - game.created_at),
            "player1_shots": _count_shots(p1) if p1 else None,
            "player2_shots": _count_shots(p2) if p2 else None,
            "player1_ships_sunk": len(p1.sunk) if p1 else 0,
            "player2_ships_sunk": len(p2.sunk) if p2 else 0,
        }

        os.makedirs(HISTORY_DIR, exist_ok=True)

        with _file_lock:
            with open(HISTORY_FILE, "a") as f:
                f.write(json.dumps(record) + "\n")

        logger.info("Game %s logged to history (reason=%s)", game.id[:8], reason)

    except Exception:
        logger.exception("Failed to log game history")


def read_game_history() -> list[dict]:
    """Read all game history records, most recent first."""
    if not os.path.exists(HISTORY_FILE):
        return []

    records = []
    with _file_lock:
        with open(HISTORY_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

    records.reverse()
    return records
