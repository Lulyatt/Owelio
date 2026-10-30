# Owelio backend

FastAPI implementation of the repository root `openapi.yaml`. Persistence uses **SQLAlchemy 2** with a URL from the environment.

## Setup

```bash
cd backend
uv sync --extra dev
```

## Database

Set **`DATABASE_URL`** (SQLAlchemy URL). Default if unset:

```text
sqlite:///./owelio.db
```

Examples (see also `.env.example`):

```bash
# SQLite file (created in backend/ when you run the server)
export DATABASE_URL=sqlite:///./owelio.db

# PostgreSQL (install driver: uv sync --extra postgres)
export DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/owelio
```

On first startup the app creates tables and seeds demo users/groups if the database is empty.

## Run

```bash
uv run uvicorn owelio.main:app --reload --port 8000
```

API base: `http://127.0.0.1:8000/api/v1`

## Auth

Register or log in to receive a bearer token (`access_token` in the JSON body). Send it on protected routes:

```http
Authorization: Bearer <token>
```

## Demo users (seeded)

| Email | Password |
| --- | --- |
| alex@example.com | password123 |
| sam@example.com | password123 |
| jo@example.com | password123 |

## Tests

Uses in-memory SQLite (`sqlite:///:memory:`) automatically.

```bash
uv run pytest
```
