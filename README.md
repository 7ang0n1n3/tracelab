# TraceLab `v0.0.2`

Self-hosted browser test automation platform. Write, run, and monitor Playwright-based tests through a web UI — no CI pipeline required.

## Features

- **Test authoring** — Monaco editor with live Playwright codegen recording
- **Test execution** — Chromium via Playwright with configurable headless/headed mode
- **Live logs** — Real-time execution output streamed via SSE
- **Artifacts** — Automatic screenshots and video recording per run
- **Auth states** — Capture and reuse browser login sessions across tests
- **User accounts** — Role-based access (Admin, Dev, QA) with per-user data siloing
- **Dashboard** — Run history, pass/fail trends, recent activity

## Quick Start

### Requirements

- Docker and Docker Compose

### Run

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the default admin account:

| Username | Password |
|----------|----------|
| sysadmin | qazxsw   |

### Stop

```bash
docker compose down
```

## Configuration

Environment variables can be set in a `.env` file at the project root:

| Variable        | Default | Description              |
|-----------------|---------|--------------------------|
| `FRONTEND_PORT` | `3000`  | Frontend port            |
| `BACKEND_PORT`  | `4000`  | Backend API port         |
| `RUNNER_PORT`   | `5000`  | Test runner port         |

## Writing Tests

Tests are written as async JavaScript using injected Playwright globals. No imports required.

```js
await page.goto(baseUrl);
await page.click('text=Sign in');
await page.fill('#email', 'user@example.com');
await page.fill('#password', 'secret');
await page.click('[type=submit]');
await takeScreenshot('after-login');
log('Login complete');
```

### Available globals

| Global           | Description                                 |
|------------------|---------------------------------------------|
| `page`           | Playwright `Page` instance                  |
| `context`        | Playwright `BrowserContext` instance        |
| `browser`        | Playwright `Browser` instance               |
| `takeScreenshot` | `(name?: string) => Promise<void>`          |
| `log`            | `(message: string) => void`                 |

> Note: `import` and `require` are not available. All Playwright APIs are accessible via the injected globals.

## Architecture

```
┌────────────┐     rewrites      ┌─────────────┐     HTTP      ┌────────────┐
│  Frontend  │ ───────────────▶  │   Backend   │ ────────────▶ │   Runner   │
│  Next.js   │                   │   Fastify   │               │  Fastify + │
│  :3000     │                   │   :4000     │               │  Playwright│
└────────────┘                   └──────┬──────┘               │  :5000     │
                                        │                       └────────────┘
                                        ▼
                                   SQLite (node:sqlite)
                                   ./data/db/tracelab.db
```

- **Frontend** — Next.js 15 (App Router, standalone output)
- **Backend** — Fastify 4 on Node.js 22 with built-in SQLite
- **Runner** — Fastify + Playwright 1.42.1 on `mcr.microsoft.com/playwright:v1.42.1-jammy`
- **Data** — Bind-mounted at `./data/` (db, artifacts, auth states, test files)

## User Roles

| Role    | Own tests | All tests | User management |
|---------|-----------|-----------|-----------------|
| `admin` | ✓         | ✓         | ✓               |
| `dev`   | ✓         | —         | —               |
| `qa`    | ✓         | —         | —               |

Admins manage users at `/admin/users`.

## Make Targets

```bash
make up        # Start all services
make down      # Stop all services
make build     # Rebuild all images
make logs      # Tail logs from all services
make ps        # Show container status
make restart   # Restart all containers
make clean     # Stop and wipe all data
make install   # npm install in all packages (for local dev)
```

## Local Development

```bash
make install

# Terminal 1 — runner
make dev-runner

# Terminal 2 — backend
make dev-backend

# Terminal 3 — frontend
make dev-frontend
```

The frontend dev server proxies `/api/*` to `http://localhost:4000`.

## Data

All persistent data lives under `./data/`:

```
data/
  db/          # SQLite database
  artifacts/   # Screenshots, videos, traces (organized by run ID)
  auth/        # Saved browser auth state JSON files
```

To reset everything: `make clean`
