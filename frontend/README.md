# Battlefield Frontend

A Battleship game with a pixel-art aesthetic, built with React 19, TypeScript, and Vite.

## Tech Stack

- **React 19** — UI framework
- **TypeScript 5.9** — type safety
- **Vite 7** — build tool and dev server
- **pixelarticons** — pixel-art SVG icon set (imported as React components via `vite-plugin-svgr`)

No state management library (Redux, Zustand, etc.) — game state is managed via a single `useGame` custom hook with sessionStorage for persistence.

## Architecture

### Screen Flow

The app uses state-based routing (no React Router). Screens progress linearly:

```
Lobby → Waiting → Setup (ship placement) → Playing → Finished
```

Navigation is driven by the `useGame` hook's `screen` state, rendered via a switch statement in `App.tsx`.

### State Management

All game state lives in `src/hooks/useGame.ts`, which orchestrates:
- API calls (via `src/services/api.ts`)
- Real-time updates (via `src/hooks/useGameStream.ts` — SSE)
- Session persistence (via `src/utils/session.ts` — sessionStorage)

### Real-Time Communication

Uses **Server-Sent Events (SSE)** for live game updates (opponent joins, shots, game over, etc.). The `useGameStream` hook manages EventSource lifecycle and dispatches typed events to handler callbacks. SSE auto-reconnects on error.

### API Layer

All HTTP calls go through `src/services/api.ts`, which provides a generic `request<T>()` function with:
- Base URL: `VITE_API_URL` env var (falls back to `/api`, which Vite proxies to `http://localhost:8084` in dev)
- Bearer token auth via `Authorization` header
- JSON content type

### Styling

- **CSS custom properties** for theming (dark/light mode via `data-theme` attribute)
- **Split CSS files** — shared styles in `src/styles/`, component styles colocated in `src/components/`
- **Pixel-art aesthetic** — `image-rendering: pixelated`, monospace font (Azeret Mono), grid backgrounds, scanline overlay, notched corner decorations
- **No CSS-in-JS or CSS modules** — plain CSS with descriptive class names

### Icons

All icons are re-exported from `src/icons/index.ts` (barrel file). SVGs from `pixelarticons` are imported as React components via `vite-plugin-svgr` with the `?react` suffix.

## Project Structure

```
src/
├── components/           # Game UI components + colocated CSS
│   ├── GameBoard.tsx      # Reusable 10x10 grid with ship rendering
│   ├── GamePlay.tsx       # Active game (dual boards, turn indicator)
│   ├── GameOver.tsx       # Victory/defeat screen with stats
│   ├── ShipPlacement.tsx  # Ship placement with drag/click/randomize
│   ├── WaitingRoom.tsx    # Opponent matching with shareable game code
│   ├── PixelParticles.tsx # Canvas-based background particle animation
│   └── *.css              # Component-scoped styles
├── hooks/
│   ├── useGame.ts         # Central game state management
│   └── useGameStream.ts   # SSE connection and event dispatching
├── services/
│   └── api.ts             # Backend API client
├── utils/
│   └── session.ts         # sessionStorage persistence helpers
├── types/
│   └── game.ts            # TypeScript types + game constants
├── icons/
│   └── index.ts           # Icon barrel file (pixelarticons re-exports)
├── styles/
│   ├── base.css           # Background, container, card, title, footer
│   ├── buttons.css        # Primary, secondary, text button styles
│   └── forms.css          # Inputs, toggles, form layout
├── App.tsx                # Root component (lobby UI + screen router)
├── index.css              # CSS reset, theme variables, global body styles
└── main.tsx               # React entry point
```

## Development

```bash
npm install
npm run dev      # starts dev server with backend proxy
```

The dev server proxies `/api` requests to `http://localhost:8084` (the Flask backend). Make sure the backend is running locally. No `.env` file is needed for local dev — the Vite proxy handles routing.

## Build

```bash
npm run build    # type-check + production build → dist/
npm run preview  # preview the production build locally
```

## Deployment

The frontend is deployed to **Vercel**. No `vercel.json` is needed — Vercel auto-detects the Vite project and runs `npm run build`.

Set `VITE_API_URL` in the Vercel project environment variables to point at the production backend.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Production only | Backend API base URL (e.g., `https://battlefield-api.onrender.com/api`). Falls back to `/api` in dev, where Vite proxies it to `localhost:8084`. |

See `.env.example` for reference. All frontend env vars must use the `VITE_` prefix (Vite requirement — vars without this prefix are not exposed to client code).
