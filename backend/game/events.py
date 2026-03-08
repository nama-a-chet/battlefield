import json
import queue


def push_event(game, player_key, event_type, data=None):
    """Push an SSE event to a specific player's stream queue."""
    player = game.get_player(player_key)
    if player is None:
        return
    q = player.stream_queue
    if q is None:
        return
    payload = {"type": event_type}
    if data is not None:
        payload["data"] = data
    q.put(payload)


def push_both(game, event_type, data=None):
    """Push an SSE event to both players."""
    push_event(game, "player1", event_type, data)
    if game.player2 is not None:
        push_event(game, "player2", event_type, data)


def format_sse(payload):
    """Format a dict as an SSE message string."""
    return f"data: {json.dumps(payload)}\n\n"


def create_stream_queue():
    """Create a new queue for SSE streaming."""
    return queue.Queue()
