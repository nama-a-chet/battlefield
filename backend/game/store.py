import threading

# All game state lives here — single worker process, shared across threads.
# store_lock protects the dicts themselves (adding/removing entries).
# Each Game object has its own lock for game-state mutations.

games = {}           # game_id -> Game
player_tokens = {}   # token -> {"game_id": ..., "player_key": "player1"|"player2"}
game_codes = {}      # 6-char code -> game_id (for joining)

store_lock = threading.Lock()
