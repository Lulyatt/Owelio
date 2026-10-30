# Owelio

Owelio helps groups split shared expenses fairly — holidays, meals, flatshares, and household bills — in any currency. Log who paid, choose how to split, and see the fewest payments needed to settle up.

This folder is the **frontend** (TanStack Start + React + Vite). The repository root has `frontend/` and `backend/` (backend to be added).

## How it works today

- All API access goes through a single **services** layer (`src/services/`). The UI uses a **mock backend** in the browser (localStorage + seeded demo data), so the app runs fully without a real server.
- Money maths (splits, rounding, balances, debt simplification) lives in `src/domain/money.ts` as tested pure functions.
- See [AGENTS.md](./AGENTS.md) for architecture notes and Lovable sync rules.

## Local development

You need [Node.js](https://nodejs.org/) (LTS) or [Bun](https://bun.sh/).

```sh
git clone git@github.com:Lulyatt/Owelio.git
cd Owelio/frontend
```

You can also run scripts from the **repository root**: `npm run dev` delegates to `frontend/`.

With **Bun** (lockfile in repo):

```sh
bun install
bun run dev
```

With **npm**:

```sh
npm install
npm run dev:fresh
```

The dev server uses **http://127.0.0.1:3000/** (port **3000**, not 8080).

**Important:** leave the terminal **running** (do not press Ctrl+C). On first run, wait until you see **`(ssr) connected`** and dependency bundling finishes (can take up to a minute), then open:

**http://127.0.0.1:3000/login**

Use **`127.0.0.1`**, not `localhost`, so you match what Vite prints.

### “Cannot GET /” in the browser

That message is **not** from Owelio’s UI — it means the browser hit **some other program** on that port (port **8080** is commonly used by Java/Tomcat and similar tools), or dev is **not running** and an old bookmark still points at the wrong URL.

1. Press **Ctrl+C** in every terminal that might be running dev.
2. From `frontend/` (or the repo root):

```sh
npm run dev:fresh
```

3. Open **http://127.0.0.1:3000/** — not `8080`, and not a saved tab from an earlier session.

If `npm run dev` fails with **“Port 3000 is already in use”**, run `dev:fresh` again or close the other program using that port.

### Demo account

- **Email:** `alex@example.com`
- **Password:** `password123`

### Useful commands

| Command | Description |
| --- | --- |
| `dev` | Start the dev server on port 3000 |
| `dev:fresh` | Kill stale dev ports, then start the server |
| `build` | Production build |
| `test` | Run Vitest |
| `lint` | ESLint |
| `format` | Prettier |

## Build with Lovable

This project is linked to [Lovable](https://lovable.dev). You can keep building in the [Lovable editor](https://lovable.dev/projects/09036c97-8b72-4edc-8a1f-d942753cdf1e); changes on the connected branch sync with this repository when you push to `main` on GitHub.
