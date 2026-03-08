# Battleship Backend

Flask API server for a real-time Battleship game supporting human-vs-human and human-vs-AI modes.

## Architecture

```
main.py                      # Flask app, health endpoint, stale game cleanup
setup/
  config.py                  # Game constants (grid size, ships, timeouts)
game/
  models.py                  # Player and Game dataclasses, game creation/joining
  store.py                   # In-memory state (games, tokens, codes) + locks
  service.py                 # Core business logic (place ships, fire, forfeit, rematch)
  validation.py              # Ship placement and shot validation
  ai.py                      # AI opponent (probability-based targeting)
  events.py                  # Server-Sent Events helpers
request_handlers/
  game_routes.py             # Thin Flask route handlers
```

### Layers

- **Routes** (`request_handlers/`) — Parse requests, authenticate via Bearer token, delegate to the service layer, return JSON.
- **Service** (`game/service.py`) — All game logic: creating/joining games, placing ships, firing shots, AI turns, forfeits, rematches, disconnect handling. Manages locking and pushes SSE events.
- **Models** (`game/models.py`) — `Player` and `Game` dataclasses. Handles game/player creation and token-based lookup.
- **Store** (`game/store.py`) — Three in-memory dicts (`games`, `player_tokens`, `game_codes`) shared across threads. A `store_lock` protects the dicts; each `Game` has its own lock for state mutations.
- **AI** (`game/ai.py`) — Probability density heat map for hunting, direction-locked targeting for finishing wounded ships.
- **Validation** (`game/validation.py`) — Bounds checking, overlap detection, turn enforcement.
- **Events** (`game/events.py`) — Pushes events to per-player `Queue` objects consumed by SSE streams.

### Key Design Decisions

- **All state is in-memory.** No database. Games are lost on restart. A background thread cleans up games inactive for 30+ minutes.
- **Single Gunicorn worker, 20 threads.** Required because state is shared in-process. Multiple workers would create isolated state islands.
- **Per-game locks.** Operations on different games don't block each other. A separate `store_lock` protects the global dicts (add/remove games).
- **SSE for real-time updates.** Each player gets a persistent `/stream` connection. Events are pushed to thread-safe queues. A 30-second heartbeat keeps connections alive.
- **AI fires immediately.** In AI mode, the AI's response shot is processed atomically under the same lock as the player's shot, so the client receives both results without a second request.
- **Disconnect grace period.** In human games, a 2-second window allows page reloads before forfeiting. AI games never forfeit on disconnect.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8084` | Server port |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:8100` | Comma-separated allowed origins |
| `FLASK_DEBUG` | `false` | Enable Flask debug mode (`true`/`false`) |

## Local Development

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run with Flask dev server
python3 main.py

# Or with Gunicorn (matches production)
gunicorn main:app --bind 0.0.0.0:8084 --workers 1 --threads 20 --timeout 0
```

## Production (Docker)

```bash
docker build -t battleship-backend .
docker run -p 8084:8084 \
  -e CORS_ALLOWED_ORIGINS="https://yourdomain.com" \
  battleship-backend
```

The `--timeout 0` in the Dockerfile CMD is required for long-lived SSE connections.

## API Overview

All game endpoints require `Authorization: Bearer <token>` (except `/health` and SSE which uses a `?token=` query param).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server status + active game count |
| `POST` | `/api/games` | Create a new game |
| `POST` | `/api/games/join` | Join by 6-char code |
| `GET` | `/api/games/:id/state` | Current game state (player-scoped) |
| `GET` | `/api/games/:id/stream` | SSE stream for real-time events |
| `POST` | `/api/games/:id/place-ships` | Place ships during setup phase |
| `POST` | `/api/games/:id/fire` | Fire a shot |
| `DELETE` | `/api/games/:id` | Forfeit |
| `POST` | `/api/games/:id/rematch` | Reset for rematch |
