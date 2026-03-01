# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Smart Advisor** is a full-stack university project with a React Native mobile frontend and a Python FastAPI backend.

## Commands

### Frontend (`/frontend`)

```bash
npm start          # Start Expo dev server
npm run android    # Run on Android emulator
npm run ios        # Run on iOS simulator
npm run web        # Run web version
npm run lint       # Run ESLint
```

### Backend (`/backend`)

```bash
# Activate virtual environment
source env/bin/activate          # macOS/Linux
.\env\Scripts\activate           # Windows

# Run the server
python3 -m uvicorn backend.main:app --reload

# Install dependencies
pip install -r requirements.txt
```

## Architecture

### Frontend (React Native + Expo)

- **Routing**: File-based via Expo Router (`app/` directory). Tabs are nested under `app/(tabs)/`.
- **Theming**: `ThemedView` / `ThemedText` components wrap all UI; dark/light mode via `useColorScheme` hook and `constants/Colors.ts`.
- **Components**: Reusable components in `components/`; `ui/` subdirectory for primitive UI elements.
- **Hooks**: Custom hooks in `hooks/` for color scheme and theme detection.

### Backend (FastAPI + SQLAlchemy)

- **Entry point**: `main.py` — FastAPI app, route definitions, and startup table creation.
- **Database**: `database.py` sets up SQLAlchemy engine (SQLite by default; override with `DATABASE_URL` env var). Sessions are injected via `get_db()` dependency.
- **Models**: `models.py` — SQLAlchemy ORM models (inheriting from `Base` defined in `database.py`).
- **Schemas**: `schema.py` — Pydantic schemas for request/response validation.
- **Auto docs**: Available at `/docs` when server is running.

### Data Flow

Frontend (React Native) ↔ Backend API (FastAPI) ↔ SQLAlchemy ORM ↔ SQLite (`sql_app.db`)

The frontend and backend are not yet connected — no API client exists in the frontend.
