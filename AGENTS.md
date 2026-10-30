For the frontend, use npm for dependency management. A few useful commands, from the repository root:

npm run install:frontend
npm run dev
npm run dev:fresh
npm test
npm run build

From `frontend/`:

npm install
npm install <package-name>
npm run dev
npm test
npm run lint

Bun works in `frontend/` as well (`bun.lock` is in the repo): `bun install`, `bun add <package-name>`, `bun run dev`.

The dev server is http://127.0.0.1:3000/. Leave it running until `(ssr) connected`. If port 3000 is already in use, run `npm run dev:fresh`.

For the backend, use uv for dependency management. From `backend/`:

uv sync --extra dev
uv run uvicorn owelio.main:app --reload --port 8000
uv run pytest

Set `DATABASE_URL` for SQLAlchemy (default `sqlite:///./owelio.db`; see `backend/.env.example`). Postgres: `uv sync --extra postgres` and `postgresql+psycopg://...`.

API: `http://127.0.0.1:8000/api/v1` (see repo root `openapi.yaml`). Auth: bearer token from `POST /auth/login` or `/auth/register`.

The frontend uses the HTTP client in `frontend/src/services/api.ts` by default (`VITE_USE_MOCK=true` for the in-browser mock). Product scope is in `_docs/specs.md`. Architecture and Lovable git rules are in `frontend/AGENTS.md`.

Regularly commit code to git. Do not rewrite published history (no force push, rebase, or amend of commits already pushed).
