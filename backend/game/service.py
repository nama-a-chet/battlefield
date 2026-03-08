import logging
import time

from setup.config import SHIPS, DISCONNECT_GRACE_SECONDS
from game.models import Game, Player, opponent_key, create_game, join_game
from game.store import games
from game.validation import validate_placement, validate_shot
from game.events import push_event, push_both
from game.ai import setup_ai_player, process_shot, ai_take_turn, ai_push_events

logger = logging.getLogger(__name__)


def create_new_game(player_name: str, mode: str) -> tuple[str, str, str]:
    """Create a new game, optionally with AI opponent. Returns (game_id, token, code)."""
    game_id, token, code = create_game(player_name, mode)

    if mode == "ai":
        game = games[game_id]
        with game.lock:
            game.player2 = Player(name="AI")
            game.phase = "setup"
            setup_ai_player(game)

    logger.info("Game %s created (mode=%s) by %s", game_id[:8], mode, player_name)
    return game_id, token, code


def join_existing_game(code: str, player_name: str) -> tuple[str | None, str]:
    """Join a game by code. Returns (game_id, token) or (None, error)."""
    game_id, result = join_game(code, player_name)

    if game_id is None:
        return None, result

    game = games.get(game_id)
    if game:
        push_event(game, "player1", "opponent_joined", {"opponent_name": player_name})
        push_both(game, "phase_change", {"phase": "setup"})
        logger.info("Game %s: %s joined", game_id[:8], player_name)

    return game_id, result


def sanitize_state(game: Game, player_key: str) -> dict:
    """Build game state visible to this player (hides opponent ships)."""
    opp_key = opponent_key(player_key)
    player = game.get_player(player_key)
    opp_player = game.get_player(opp_key)

    state = {
        "game_id": game.id,
        "code": game.code,
        "phase": game.phase,
        "current_turn": game.current_turn,
        "winner": game.winner,
        "you": player_key,
        "your_name": player.name,
        "your_ships": player.ships,
        "your_board": player.board,
        "your_shots": player.shots,
        "your_ready": player.ready,
        "your_sunk": player.sunk,
        "mode": game.mode,
    }

    if opp_player:
        state["opponent_name"] = opp_player.name
        state["opponent_ready"] = opp_player.ready
        state["opponent_sunk"] = opp_player.sunk
        state["opponent_connected"] = opp_player.connected
        # Reveal positions of sunk ships only
        state["opponent_sunk_ships"] = {
            name: opp_player.ships[name]
            for name in opp_player.sunk
            if name in opp_player.ships
        }
    else:
        state["opponent_name"] = None
        state["opponent_ready"] = False
        state["opponent_sunk"] = []
        state["opponent_connected"] = False
        state["opponent_sunk_ships"] = {}

    return state


def place_player_ships(game: Game, player_key: str, ships_data: dict) -> tuple[bool, str | None]:
    """Validate and place ships for a player. Returns (success, error)."""
    if game.phase != "setup":
        return False, "Not in setup phase"

    player = game.get_player(player_key)
    if player.ready:
        return False, "Ships already placed"

    ships_cells, error = validate_placement(ships_data)
    if error:
        return False, error

    opp_key = opponent_key(player_key)

    with game.lock:
        player.ships = ships_cells
        player.ready = True
        for cells in ships_cells.values():
            for r, c in cells:
                player.board[r][c] = "ship"
        game.last_activity = time.time()

    # Notify opponent
    opp_player = game.get_player(opp_key)
    if opp_player:
        push_event(game, opp_key, "opponent_ready", {})

    # Check if both players ready -> start playing
    if opp_player and opp_player.ready and player.ready:
        with game.lock:
            game.phase = "playing"
            game.current_turn = "player1"
        push_both(game, "phase_change", {
            "phase": "playing",
            "current_turn": "player1",
        })
        logger.info("Game %s: both players ready, playing", game.id[:8])

    return True, None


def fire_player_shot(game: Game, player_key: str, row: int, col: int) -> tuple[dict | None, str | None]:
    """Fire a shot. Returns (result_dict, error)."""
    error = validate_shot(game, player_key, row, col)
    if error:
        return None, error

    opp_key = opponent_key(player_key)
    ai_result = None

    with game.lock:
        result = process_shot(game, player_key, row, col)

        if not result["game_over"]:
            game.current_turn = opp_key

            # If AI mode, AI fires back immediately (still under lock)
            if game.mode == "ai" and opp_key == "player2":
                ai_result = ai_take_turn(game)
                if not ai_result["game_over"]:
                    game.current_turn = "player1"

    # Push events outside lock (queue puts are thread-safe)
    push_event(game, player_key, "shot_result", result)
    push_event(game, opp_key, "opponent_shot", {
        "row": row,
        "col": col,
        "result": result["result"],
        "sunk": result["sunk"],
    })

    if result["game_over"]:
        push_both(game, "game_over", {
            "winner": player_key,
            "reason": "all_ships_sunk",
        })
        logger.info("Game %s: %s wins", game.id[:8], player_key)
        return result, None

    if ai_result is not None:
        ai_push_events(game, ai_result)
        if not ai_result["game_over"]:
            push_event(game, "player1", "phase_change", {
                "phase": "playing",
                "current_turn": "player1",
            })
    else:
        push_both(game, "phase_change", {
            "phase": "playing",
            "current_turn": opp_key,
        })

    return result, None


def forfeit_game(game: Game, player_key: str) -> tuple[bool, str | None]:
    """Forfeit the game. Returns (success, error)."""
    if game.phase == "finished":
        return False, "Game already finished"

    opp_key = opponent_key(player_key)

    with game.lock:
        game.phase = "finished"
        game.winner = opp_key

    push_event(game, opp_key, "game_over", {
        "winner": opp_key,
        "reason": "opponent_forfeited",
    })
    push_event(game, player_key, "game_over", {
        "winner": opp_key,
        "reason": "you_forfeited",
    })

    logger.info("Game %s: %s forfeited", game.id[:8], player_key)
    return True, None


def rematch_game(game: Game) -> tuple[bool, str | None]:
    """Reset game for rematch. Returns (success, error)."""
    if game.phase != "finished":
        return False, "Game not finished"

    with game.lock:
        for key in ("player1", "player2"):
            old_player = game.get_player(key)
            new_player = Player(name=old_player.name)
            new_player.stream_queue = old_player.stream_queue
            new_player.connected = old_player.connected
            game.set_player(key, new_player)

        game.phase = "setup"
        game.current_turn = "player1"
        game.winner = None
        game.last_activity = time.time()

        if game.mode == "ai":
            setup_ai_player(game)

    push_both(game, "phase_change", {"phase": "setup"})
    logger.info("Game %s: rematch started", game.id[:8])
    return True, None


def handle_disconnect(game: Game, player_key: str) -> None:
    """Handle player SSE disconnect — forfeit if in active human game."""
    with game.lock:
        player = game.get_player(player_key)
        player.connected = False
        player.stream_queue = None

    # Never forfeit AI games on disconnect (just a page refresh)
    if game.mode == "ai":
        return

    # Only forfeit during active phases
    if game.phase not in ("setup", "playing"):
        return

    # Grace period for page reloads
    time.sleep(DISCONNECT_GRACE_SECONDS)

    # Check if they reconnected during grace period
    player = game.get_player(player_key)
    if player.connected:
        return

    # Forfeit
    opp_key = opponent_key(player_key)
    with game.lock:
        game.phase = "finished"
        game.winner = opp_key

    push_event(game, opp_key, "game_over", {
        "winner": opp_key,
        "reason": "opponent_left",
    })
    logger.info("Game %s: %s disconnected, forfeited", game.id[:8], player_key)
