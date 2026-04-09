# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Smart Advisor** is a full-stack university academic advising app. Students select their major, and an AI-powered advisor generates personalized semester course plans based on prerequisites, credit limits, CGPA, and requirement progress.

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
python -m uvicorn backend.main:app --reload

# Install dependencies
pip install -r requirements.txt

# Seed the database with course data
python -m backend.data.seed
```

**Environment variables**: Create `.env` in `/backend` with:
- `OPENAI_API_KEY` — Required for AI course recommendations
- `DATABASE_URL` — Optional; defaults to SQLite (`sql_app.db`)

## Architecture

### Frontend (React Native + Expo)

- **Routing**: File-based via Expo Router (`app/` directory). Auth flow in `app/(auth)/`, main tabs in `app/(tabs)/`.
- **API Client**: `services/api.ts` — typed fetch wrapper for all backend endpoints. Auto-detects backend IP in dev mode.
- **Theming**: `ThemedView` / `ThemedText` components wrap all UI; dark/light mode via `useColorScheme` hook and `constants/Colors.ts`.

### Backend (FastAPI + SQLAlchemy)

- **Entry point**: `main.py` — FastAPI app with CORS, auth routes (`/auth/*`), user routes, and advisor router.
- **Advisor module**: `advisor.py` — AI-powered course planning. Uses GPT-4o with function calling to generate semester plans based on prerequisites, unlock priority, credit fit, and difficulty ratings.
- **Auth**: `auth.py` — JWT-based authentication with `get_current_user` dependency.
- **Database**: `database.py` — SQLAlchemy engine (SQLite default). Sessions via `get_db()` dependency.
- **Models**: `models.py` — User, Student, Major, Requirement, Course, Semester, SemesterCourse, Prerequisite, CourseFeedback.
- **Seed data**: `data/seed.py` loads `data/uon_cs_seed.json` with majors, courses, requirements, and prerequisites.

### Data Flow

```
Frontend (React Native) → services/api.ts → Backend API (FastAPI) → SQLAlchemy ORM → SQLite
                                                    ↓
                                              OpenAI GPT-4o (for /advisor/generate)
```

### Key API Endpoints

- `POST /auth/register`, `POST /auth/login` — Authentication
- `GET /majors`, `POST /users/me/major` — Major selection
- `POST /advisor/generate` — AI generates course plan for a semester
- `POST /advisor/enroll` — Save generated plan as a planned semester
- `GET /advisor/semesters` — List all student semesters with courses
- `POST /advisor/semesters/{id}/complete` — Submit grades, calculate GPA
- `GET /advisor/progress` — Overall degree progress summary
