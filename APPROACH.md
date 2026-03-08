# Approach

## Overview

This is a real-time, multiplayer Battleship game built as a weekend spike. The goal was to ship something fun and polished quickly — prioritizing ease of deployment, a strong UI, and a playable AI opponent over production-grade infrastructure.

I used Claude (Anthropic's AI) extensively throughout development — for architecture decisions, implementing the AI opponent logic, building out the SSE event system, writing the pixel-art CSS, and iterating on the frontend components. The AI was especially useful for the probability heatmap math and the fiddly CSS work (pixel corners, scanlines, ship hull rendering with clip-paths).

---

## Design Choices

### Visual Identity

The UI leans into a retro/pixel-art aesthetic:

- **Font**: Azeret Mono (Google Fonts) — a monospace font that feels like a terminal/radar screen
- **Color palette**: Deep dark backgrounds (`#0a0a0f`) with a single pop color — purple (`#5E38F5`) — used for accents, buttons, and highlights. The constraint of one accent color keeps the visual language tight
- **Pixel rendering**: The title text renders at 6px font size and scales up 6x with `image-rendering: pixelated` for hard pixel edges — a CSS trick that avoids actual pixel art assets
- **Scanlines & grid**: Subtle CRT scanline overlay and a repeating purple grid background sell the "radar screen" vibe without being distracting
- **Pixel corners**: Cards have notched corners built purely in CSS (no images), giving them a retro UI frame look
- **Icon library**: [pixelarticons](https://pixelarticons.com/) — a free set of pixel-art SVG icons. Imported as React components via `vite-plugin-svgr`. All icons go through a barrel file (`icons/index.ts`) to keep imports consistent
- **Light/dark theme**: CSS custom properties on `:root` / `[data-theme="light"]` with a toggle button. The dark theme is the default and the "intended" experience

### Why These Choices

The pixel aesthetic was chosen because it's distinctive, cohesive, and achievable with pure CSS — no design tools or asset pipelines needed. A monospace font, a single accent color, and pixel icons create a strong visual identity with minimal effort. This let me spend time on gameplay instead of design iteration.

---

## AI Opponent Logic

The AI uses a two-phase strategy inspired by how skilled human players think:

### Hunt Mode (no active hits)

When the AI has no unsunk hits on the board, it uses a **probability density heatmap**. For every empty cell, it counts how many ways remaining (unsunk) ships could pass through that cell — horizontally and vertically. Cells with higher counts are more likely to contain a ship. The AI picks randomly among the highest-probability cells.

This naturally produces smart behavior: it avoids corners early (fewer ship placements possible), clusters shots toward the center, and adapts as ships are sunk (removing their sizes from the calculation).

### Target Mode (active hits exist)

When the AI has hit a ship but hasn't sunk it yet:

- **Single hit**: Probe all 4 orthogonal neighbors
- **Line of hits** (same row or column): Lock direction and only probe the two ends of the line
- **L-shaped hits** (two adjacent ships overlapping in neighbors): Probe all neighbors of all hits

When multiple target cells are available, the AI still uses the probability heatmap to pick the smartest one — combining targeted pursuit with statistical reasoning.

### Complexity at Scale

The heatmap computation is O(S * G^2) where S is the number of remaining ship sizes and G is the grid size. At 10x10 this is trivial. At 100x100 it's still fast (~50K cells * ~5 ships). At 1000x1000 (1M cells), the nested loops would need optimization — likely precomputing valid placement intervals per row/column rather than checking each cell individually, or using numpy vectorization.

---

## Real-Time Communication: SSE over WebSockets

### Why SSE (Server-Sent Events)

The game uses SSE for real-time updates instead of WebSockets or polling. The reasoning:

- **Simpler server-side**: SSE is just a long-lived HTTP response that streams text. No protocol upgrade, no frame parsing, no ping/pong. Flask can serve it with a generator function — no additional libraries needed
- **Simpler deployment**: SSE works through standard HTTP proxies and load balancers without special configuration. WebSockets require proxy upgrades (`Upgrade: websocket` header handling) which some platforms don't support cleanly
- **Sufficient for this use case**: Battleship is turn-based. The client sends moves via normal POST requests; only the server needs to push events (opponent's shot, phase changes, game over). SSE's unidirectional server→client model fits perfectly
- **Built-in reconnection**: The browser's `EventSource` API automatically reconnects on disconnect — free resilience

### Why Not WebSockets

WebSockets would be the right choice for high-frequency bidirectional communication (chat, collaborative editing, real-time games with continuous input). Battleship doesn't need that — a player fires one shot, waits for the opponent. The overhead of a WebSocket library and connection management isn't justified.

### Why Not Polling

Polling adds latency (you only see updates on the next poll interval) and wastes bandwidth (constant requests even when nothing changes). SSE gives instant delivery with zero wasted requests.

---

## Backend Architecture

### Single Worker, In-Memory State

The backend runs as a single Gunicorn worker with 20 threads. All game state lives in Python dicts protected by threading locks — no database, no Redis, no external state.

This is a deliberate constraint:

- **Single worker is required**: With in-memory state, multiple workers would create isolated state islands. Player 1 might be in worker A's memory while player 2 is in worker B — they'd never see each other. A single worker with threads handles concurrency fine for this scale
- **No timeout** (`--timeout 0`): SSE connections are long-lived. Gunicorn's default 30-second worker timeout would kill them
- **Cleanup daemon**: A background thread removes games inactive for 30+ minutes, preventing unbounded memory growth

### Capacity: ~10 Concurrent Games

With a single worker and 20 threads, the server comfortably handles around 10 concurrent games (20 SSE connections + HTTP requests). Each game is lightweight — two 10x10 grids, a few lists, a lock. Memory isn't the bottleneck; thread count is, since each SSE connection holds a thread.

To scale beyond this, the architecture would need to change: move to an async framework (FastAPI with uvicorn, or Node.js), use Redis for shared state, and run multiple workers. But for a weekend project meant for a handful of friends, 10 concurrent games is plenty.

### Locking Discipline

Two lock levels prevent race conditions:
- **`store_lock`** (global): Protects the game/token/code lookup dicts
- **`game.lock`** (per-game): Protects mutations to a single game's state

Rule: always acquire `store_lock` before `game.lock` if both are needed (prevents deadlocks). SSE events are pushed outside locks since queue puts are thread-safe.

---

## Database Choice (None)

There is no database. This was intentional:

- **Speed of development**: No schema design, no migrations, no ORM, no connection pooling. Just Python dicts
- **Deployment simplicity**: No database provisioning, no connection strings, no managed service costs
- **Acceptable tradeoff**: Game state is ephemeral by nature — a Battleship game lasts 5-15 minutes. There's no user accounts, no persistent profiles, no leaderboards that need durability

### Game History Logging

Completed games are logged to a JSONL file on disk (`data/game_history.jsonl`). Each line is a JSON object with player names, winner, reason, shot counts, and duration. An admin dashboard at `/admin` (password-protected) displays this history.

**The limitation**: Since the backend runs on Render, the filesystem is ephemeral — logs persist while the server is running but are wiped on redeploy or restart. This is a known tradeoff. I didn't want to set up a database just for game logs on a weekend project. If durability mattered, the fix would be straightforward: swap the JSONL append for an insert into SQLite (still no external service) or a hosted Postgres.

---

## Preventing Cheating

### Current Protections

The server is the authority on all game state. The client never sees information it shouldn't:

- **Ship positions are hidden**: The `sanitize_state()` function strips opponent ship locations from the response. Only sunk ship positions are revealed (so the client can render them in red). A player cannot inspect network responses to find opponent ships
- **Server-side validation**: Every shot is validated — correct turn, valid coordinates, no re-firing on the same cell. The client can't fire out of turn or skip validation
- **Token-based auth**: Each player gets a UUID token on join. All requests require this token. You can't impersonate another player or interact with a game you're not in

### What's Not Protected

- **No rate limiting**: A player could spam the fire endpoint. In practice this doesn't matter since the server enforces turn order, but it could be used for a trivial DoS
- **Token in URL for SSE**: The SSE endpoint passes the token as a query parameter (EventSource doesn't support headers). This means the token appears in server logs and browser history. For a casual game this is fine; for anything serious, you'd use a short-lived SSE ticket
- **No anti-bot measures**: Nothing prevents writing a script that plays optimally. The AI opponent already uses the best known strategy (probability heatmap), so a bot wouldn't have an unfair advantage — it would just play as well as the AI does

### Scaling the Board

At larger board sizes (100x100 or 1000x1000), new cheating vectors emerge:

- **Timing attacks**: On a 1000x1000 board, the probability heatmap computation takes measurably longer. A sophisticated client could infer ship positions from response latency differences (hits near ships change the heatmap more). Mitigation: add constant-time padding to responses
- **State size**: A 1000x1000 board has 1M cells. The current approach of sending the full board state on each request would be expensive. You'd need delta updates (only send changed cells) or a viewport system (only send the area the player is looking at)
- **Memory**: 10 concurrent games at 1000x1000 with two boards each = 20M cells in memory. Still manageable (~160MB for string arrays), but approaching the point where you'd want more careful memory management

---

## Deployment

### Frontend (Vercel)
- Vite builds to static files (`dist/`), deployed automatically on push
- `vercel.json` handles SPA fallback for client-side routing (`/admin`)
- `VITE_API_URL` env var points to the Render backend

### Backend (Render)
- Dockerized Flask app, single Gunicorn worker
- Auto-deploys from the `main` branch
- No external services — fully self-contained

The whole stack deploys in under 2 minutes from push to live. No CI pipeline, no build steps beyond `npm run build` and `docker build`. This was the goal: minimize the distance between writing code and having it running in production.

---

## Use of AI

Claude was used as a pair programmer throughout this project:

- **Architecture**: Discussed SSE vs WebSocket tradeoffs, in-memory vs database, single worker constraints
- **AI opponent**: Implemented the probability heatmap algorithm and direction-locking target mode. The math for counting valid ship placements per cell was generated and iterated on with Claude
- **CSS/UI**: The pixel-art aesthetic — scanlines, pixel corners, ship hull rendering with clip-paths and pseudo-elements, the 6px-scaled title trick — was built collaboratively. CSS is where AI assistance saved the most time
- **Game logic**: Shot validation, ship sinking detection, win conditions, SSE event flow, disconnect handling with grace periods
- **Admin dashboard**: The game history logging system and password-protected admin page were designed and implemented with Claude

The project demonstrates how AI-assisted development changes the calculus of what's achievable in a weekend. The pixel-art CSS alone would have taken a full day to get right manually; with Claude, it was an afternoon.
