# Battleship Frontend

## Quick Reference

- **Stack**: React 19 + TypeScript 5.9 + Vite 7
- **Deployment**: Vercel (auto-detected, no vercel.json needed)
- **Backend URL**: Set via `VITE_API_URL` env var (falls back to `/api` which Vite proxies to `localhost:8084` in dev)
- **Build**: `npm run build` (runs `tsc -b && vite build`, output in `dist/`)
- **Dev**: `npm run dev` (requires backend running on port 8084)
- **Path alias**: `@` → `src/` (configured in vite.config.ts and tsconfig.app.json)

## Architecture

### No Router

The app uses state-based screen switching in `App.tsx` (not React Router). Five screens: `lobby → waiting → setup → playing → finished`. All navigation is driven by `useGame` hook state.

### State Management

Single `useGame` hook owns all game state. No Redux/Zustand. State flows:
- User actions → `useGame` methods → API calls → state updates → re-render
- Server events → SSE stream → `useGameStream` handlers → state updates → re-render

### Key Files

| File | Purpose |
|------|---------|
| `hooks/useGame.ts` | Central game state, API orchestration |
| `hooks/useGameStream.ts` | SSE connection lifecycle, typed event dispatch |
| `services/api.ts` | All HTTP calls, generic `request<T>()` with Bearer auth |
| `utils/session.ts` | sessionStorage helpers (save/restore/clear) |
| `types/game.ts` | All TypeScript types + constants (SHIPS, GRID_SIZE, etc.) |
| `icons/index.ts` | Barrel file re-exporting pixelarticons SVGs as React components |

### CSS Architecture

Styles are split into shared (`src/styles/`) and component-colocated (`src/components/*.css`):
- `styles/base.css` — backgrounds, container, card, title, footer, error states
- `styles/buttons.css` — primary, secondary, text buttons, disabled states
- `styles/forms.css` — inputs, toggles, form layout
- Component CSS files imported directly by their component

Theme uses CSS custom properties (`:root` / `[data-theme="light"]` in `index.css`). Toggle via `data-theme` attribute on `<html>`.

## Critical Rules

- **Backend URL via `VITE_API_URL`** — set in `.env` / Vercel env vars for production. In dev, omit it to use the Vite proxy (`/api` → `localhost:8084`). All env vars must be prefixed with `VITE_` to be exposed to client code (Vite requirement).
- **All data access goes through `services/api.ts`** — never call external services or fetch directly from components.
- **Icons must be imported from `@/icons`** — never import directly from `pixelarticons`. Add new icons to `icons/index.ts` first.
- **SVGs use the `?react` suffix** for component imports (e.g., `import Foo from 'pixelarticons/svg/foo.svg?react'`).
- **sessionStorage (not localStorage)** for game session — data clears when tab closes, preventing stale sessions.
- **Font loaded via Google Fonts in `index.html`** — Azeret Mono. Don't add it to CSS `@import`.

## Patterns to Follow

- Constants go in `types/game.ts` (game rules) or at the top of the file that uses them (implementation details like delays).
- Error handling: use `catch (e: unknown)` with the `getErrorMessage()` helper in `useGame.ts`. Never use `catch (e: any)`.
- New API endpoints: add to `services/api.ts` with proper TypeScript return types.
- New SSE events: add handler type to `GameStreamHandlers` in `useGameStream.ts`, add case to the switch.
- New components: create colocated CSS file (e.g., `ComponentName.css`), import it in the component.

## Plans

Save implementation plans in `claude_plans/` (gitignored). Use date-prefixed filenames: `YYYY-MM-DD_HH-MM_description.md`.
