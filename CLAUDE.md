# Battleship Workspace

## Architecture Overview

This is a monorepo containing the Battleship web app and its backend:
- `frontend/` - React + Vite web application
- `backend/` - Flask REST API

## File Structure

```
frontend/                  # React + Vite
├── src/
│   ├── components/        # Game UI components + colocated CSS
│   ├── hooks/             # Custom React hooks (useGame, useGameStream)
│   ├── services/          # API client
│   ├── utils/             # Utilities (session persistence)
│   ├── types/             # TypeScript type definitions + constants
│   ├── icons/             # Icon barrel file (pixelarticons re-exports)
│   ├── styles/            # Shared styles (base, buttons, forms)
│   ├── App.tsx            # Root component (lobby UI + screen router)
│   ├── index.css          # CSS reset + theme variables
│   └── main.tsx           # Entry point
├── public/                # Static files (favicon, crosshair cursor)
├── index.html             # HTML entry point
├── vite.config.ts         # Vite configuration
├── tsconfig.json
└── package.json

backend/                   # Flask API
├── main.py                # Flask app entry point
├── requirements.txt
├── Dockerfile
├── setup/                 # Config, auth, clients
└── request_handlers/      # Route handlers
```

## Plans

When creating implementation plans, save them as markdown files in `claude_plans/` directories (gitignored). Use date-prefixed filenames for chronological sorting:
- `backend/claude_plans/YYYY-MM-DD_description.md`
- `frontend/claude_plans/YYYY-MM-DD_description.md`
- `claude_plans/YYYY-MM-DD_description.md` (top-level, cross-cutting plans)

## Frontend (React + Vite)

### Local Development

```bash
cd frontend
npm install
npm run dev
```

### Build

```bash
cd frontend
npm run build    # outputs to dist/
npm run preview  # preview production build locally
```

## Backend (Flask API)

### Local Development

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set environment variables (or use .env.local)
gunicorn main:app --bind 0.0.0.0:8084 --threads 4 --timeout 120
```

## Critical Rules

### No Direct Database Calls from Frontend
All data access must go through backend API endpoints.

### Database Changes Require Migrations
Never modify the database schema directly. Always create proper migrations.
