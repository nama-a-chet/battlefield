# Battlefield Backend

## Deployment

- **Deployed to Render** 
- Docker-based deployment using `Dockerfile`
- Single Gunicorn worker, 20 threads, no request timeout (`--timeout 0` for SSE)

## Critical Rules

### Single Worker is Required
All game state is in-memory (no database). The server MUST run with `--workers 1` — multiple workers would create isolated state islands where players can't see each other's games. If you ever add persistence (Redis, DB), this constraint can be relaxed.

### Never Set `--timeout` to a Positive Value
SSE streams are long-lived connections. Gunicorn's default 30-second timeout would kill them. The Dockerfile uses `--timeout 0` — do not change this.

### Locking Discipline
- `store_lock` (in `game/store.py`): protects the global dicts (`games`, `player_tokens`, `game_codes`). Use for adding/removing games.
- `game.lock` (per-Game instance): protects mutations to a single game's state. Use for gameplay operations (fire, place ships, etc.).
- Always acquire `store_lock` before `game.lock` if you ever need both (to avoid deadlocks). In practice, you rarely need both.
- Push SSE events OUTSIDE locks — `queue.put()` is thread-safe and avoids holding the lock during I/O.

### State is Ephemeral
All game state lives in memory and is lost on server restart. A cleanup daemon removes games inactive for 30 minutes. There is no database.

## Architecture

```
main.py                      # Flask app, health endpoint, cleanup daemon
setup/
  config.py                  # Game constants (grid size, ships, timeouts)
game/
  store.py                   # In-memory state dicts + store_lock
  models.py                  # Player/Game dataclasses, create/join/lookup
  service.py                 # Business logic (place ships, fire, forfeit, rematch)
  validation.py              # Ship placement + shot validation
  ai.py                      # AI opponent (probability heat map + direction locking)
  events.py                  # SSE push helpers
request_handlers/
  game_routes.py             # Thin Flask routes (parse, auth, delegate to service)
```

### Layer Responsibilities
- **Routes** parse HTTP, extract tokens, call service functions, return JSON. No game logic here.
- **Service** orchestrates game operations: acquires locks, mutates state, pushes SSE events, logs actions.
- **Models** define `Player` and `Game` dataclasses. Handle game creation, joining, and token-based lookup.
- **AI** is self-contained: `ai_choose_shot()` picks targets, `process_shot()` applies them. AI fires back atomically within the same lock acquisition as the player's shot.

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
python3 main.py
```

Or with Gunicorn (matches production):
```bash
gunicorn main:app --bind 0.0.0.0:8084 --workers 1 --threads 20 --timeout 0
```

## Game Flow

1. Player creates game → gets `token` + 6-char `code`
2. Opponent joins with code (or AI is created automatically)
3. Both players place ships → phase transitions to "playing"
4. Players alternate shots until all opponent ships sunk
5. Optional rematch resets to setup phase

## Key Implementation Details

- **Auth**: Bearer token (UUID) in `Authorization` header. SSE uses `?token=` query param (EventSource doesn't support headers).
- **SSE heartbeat**: Sent every 30 seconds to keep connections alive through proxies/load balancers.
- **Disconnect handling**: 2-second grace period for page reloads before forfeiting. AI games never forfeit on disconnect.
- **AI turn**: Processed atomically under the same `game.lock` as the player's shot, so the client gets both results from a single `/fire` request.
- **Game codes**: 6-char uppercase alphanumeric, deleted from the lookup dict once someone joins (preventing third-party joining).

## Plans

Save implementation plans to `claude_plans/` (gitignored) with date-prefixed filenames: `YYYY-MM-DD_HH-MM_description.md`.
