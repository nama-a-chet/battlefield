from __future__ import annotations

import random
import string
import time
import uuid
from dataclasses import dataclass, field
from queue import Queue
from threading import Lock

from setup.config import GRID_SIZE, GAME_CODE_LENGTH
from game.store import games, player_tokens, game_codes, store_lock


@dataclass
class Player:
    name: str
    ships: dict[str, list[list[int]]] = field(default_factory=dict)
    board: list[list[str | None]] = field(
        default_factory=lambda: [[None] * GRID_SIZE for _ in range(GRID_SIZE)]
    )
    shots: list[list[str | None]] = field(
        default_factory=lambda: [[None] * GRID_SIZE for _ in range(GRID_SIZE)]
    )
    ready: bool = False
    sunk: list[str] = field(default_factory=list)
    connected: bool = False
    stream_queue: Queue | None = None


@dataclass
class Game:
    id: str
    code: str
    mode: str  # "human" or "ai"
    phase: str = "waiting"  # waiting -> setup -> playing -> finished
    player1: Player | None = None
    player2: Player | None = None
    current_turn: str = "player1"
    winner: str | None = None
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    lock: Lock = field(default_factory=Lock, repr=False)

    def get_player(self, key: str) -> Player | None:
        if key == "player1":
            return self.player1
        if key == "player2":
            return self.player2
        return None

    def set_player(self, key: str, player: Player) -> None:
        if key == "player1":
            self.player1 = player
        elif key == "player2":
            self.player2 = player


def opponent_key(player_key: str) -> str:
    return "player2" if player_key == "player1" else "player1"


def generate_game_code() -> str:
    """Generate a unique 6-char uppercase alphanumeric code."""
    while True:
        code = "".join(
            random.choices(string.ascii_uppercase + string.digits, k=GAME_CODE_LENGTH)
        )
        if code not in game_codes:
            return code


def create_game(player_name: str, mode: str = "human") -> tuple[str, str, str]:
    """Create a new game. Returns (game_id, player_token, game_code)."""
    game_id = str(uuid.uuid4())
    token = str(uuid.uuid4())
    code = generate_game_code()

    game = Game(
        id=game_id,
        code=code,
        mode=mode,
        player1=Player(name=player_name),
    )

    with store_lock:
        games[game_id] = game
        player_tokens[token] = {"game_id": game_id, "player_key": "player1"}
        game_codes[code] = game_id

    return game_id, token, code


def join_game(code: str, player_name: str) -> tuple[str | None, str]:
    """Join an existing game by code. Returns (game_id, player_token) or (None, error_msg)."""
    with store_lock:
        game_id = game_codes.get(code.upper())
        if not game_id:
            return None, "Invalid game code"

        game = games.get(game_id)
        if not game:
            return None, "Game not found"

        if game.phase != "waiting":
            return None, "Game already started"

        if game.player2 is not None:
            return None, "Game is full"

        token = str(uuid.uuid4())
        game.player2 = Player(name=player_name)
        game.phase = "setup"
        game.last_activity = time.time()

        player_tokens[token] = {"game_id": game_id, "player_key": "player2"}

        # Remove code so no one else can join
        del game_codes[code.upper()]

    return game_id, token


def get_game_and_player(token: str) -> tuple[Game | None, str | None]:
    """Look up game and player_key from token. Returns (game, player_key) or (None, None)."""
    info = player_tokens.get(token)
    if not info:
        return None, None
    game = games.get(info["game_id"])
    if not game:
        return None, None
    return game, info["player_key"]
