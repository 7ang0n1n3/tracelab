<p align="center">
  <img src="tracelab_logo.png" alt="TraceLab" width="260" />
</p>

# TraceLab `v0.1.23`

Self-hosted browser test automation platform. Write, run, and monitor Playwright-based tests through a web UI — no CI pipeline required.

## Features

- **Test authoring** — Monaco editor with live Playwright codegen recording
- **Test execution** — Chromium, Firefox, or WebKit via Playwright with configurable headless/headed mode
- **Live logs** — Real-time execution output streamed via SSE
- **Artifacts** — Automatic screenshots and video recording per run; export any run as a ZIP (screenshots, video, trace, log)
- **Retry on failure** — auto-retry failed/errored runs; system-wide default with per-test override (0–10 retries)
- **Dependency chaining** — chain tests into sequential pipelines (A→B→C→D) with per-link continue-on-failure control and cycle detection
- **Scheduled runs** — time-based triggers per test; friendly frequency picker (every N minutes, hourly, daily, weekly, monthly) with no cron knowledge required; enable/disable per schedule; global `/schedules` view and per-test panel
- **Run queue** — live view of all pending and running tests with elapsed timers and sidebar count badge
- **Auth states** — Capture and reuse browser login sessions across tests
- **Bulk operations** — Select multiple tests or runs; bulk delete, bulk run, or bulk tag tests with add/remove/replace modes
- **Test sharing** — Share tests with specific users or entire roles (read-only or read-write)
- **User accounts** — Role-based access (Admin, Dev, QA) with per-user data siloing
- **Dashboard** — Run history, pass/fail trends, recent activity
- **Branding** — Custom logo on login screen and sidebar with version display

## Quick Start

TraceLab can be run two ways — in Docker (recommended) or directly on your local machine.

---

### Option 1 — Docker

**Requirements:** Docker and Docker Compose

```bash
# Start
./start-docker.sh start

# Stop
./start-docker.sh stop
```

Additional flags:

```bash
./start-docker.sh start --build   # Rebuild images before starting
./start-docker.sh start --logs    # Follow logs after start
```

---

### Option 2 — Local (no Docker)

**Requirements:** Node.js 22+

```bash
# Start (installs dependencies automatically on first run)
./start-local.sh
```

Press `Ctrl+C` to stop all services. Logs are written to `.logs/` and streamed to the terminal.

---

Once running, open [http://localhost:3273](http://localhost:3273) and sign in with the default admin account:

| Username | Password |
|----------|----------|
| sysadmin | qazxsw   |

> Change the default password after first login via the Users page (`/admin/users`).

## Configuration

Environment variables can be set in a `.env` file at the project root:

| Variable        | Default | Description                                                    |
|-----------------|---------|----------------------------------------------------------------|
| `FRONTEND_PORT` | `3273`  | Frontend host port                                             |
| `FRONTEND_URL`  | `http://localhost:3273` | Public browser URL allowed by backend CSRF checks |
| `BACKEND_PORT`  | `4273`  | Backend host port                                              |
| `RUNNER_PORT`   | `5273`  | Test runner host port                                          |
| `NOVNC_PORT`    | `6353`  | noVNC host port for live browser view during headed runs       |
| `RUNNER_SECRET` | *(none)*| Shared secret between backend and runner (set for security)    |
| `HTTPS_ONLY`    | `false` | Set to `true` to mark session cookies as Secure (HTTPS only)  |

For Docker or Portainer deployments accessed by server IP or domain, set `FRONTEND_URL` to the exact browser URL, for example `http://10.0.1.115:3273`. Otherwise login requests can be blocked by the backend CSRF origin check.

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

| Global           | Type / Signature                                  | Description                                                  |
|------------------|---------------------------------------------------|--------------------------------------------------------------|
| `page`           | Playwright `Page`                                 | Current browser page                                         |
| `context`        | Playwright `BrowserContext`                       | Browser context (cookies, storage)                           |
| `browser`        | Playwright `Browser`                              | Browser instance                                             |
| `baseUrl`        | `string \| null`                                  | The test's configured Base URL field (may be null)           |
| `takeScreenshot` | `(name?: string) => Promise<string>`              | Saves a screenshot; returns the file path                    |
| `log`            | `(message: string) => void`                       | Appends a timestamped line to the run log                    |

> **Sandbox restrictions:** Scripts run inside a Node.js `vm` context — `import`, `require`, `process`, and other Node.js globals are not available. Certain Playwright APIs that could enable SSRF or credential exfiltration are also blocked: `page.route`, `page.exposeFunction`, `context.storageState`, `browser.newContext`, and similar methods.

> **Failure screenshot:** If a test throws an uncaught error, a `failure.png` is automatically captured from the current page before the run is marked failed.

> **Headed mode:** When a test runs with headless disabled, a live browser view is available via noVNC at `http://localhost:<NOVNC_PORT>` (default host port 6353).

## Architecture

```
┌────────────┐     rewrites      ┌─────────────┐     HTTP      ┌────────────┐
│  Frontend  │ ───────────────▶  │   Backend   │ ────────────▶ │   Runner   │
│  Next.js   │                   │   Fastify   │               │  Fastify + │
│  :3273     │                   │   :4273     │               │  Playwright│
└────────────┘                   └──────┬──────┘               │  :5273     │
                                        │                      └────────────┘
                                        ▼
                                   SQLite (node:sqlite)
                                   ./data/db/tracelab.db
```

- **Frontend** — Next.js 15 (App Router, standalone output)
- **Backend** — Fastify 4 on Node.js 22 with built-in SQLite
- **Runner** — Fastify + Playwright 1.59.1 on `mcr.microsoft.com/playwright:v1.59.1-jammy`
- **Data** — Bind-mounted at `./data/` (db, artifacts, auth states, test files)

Docker publishes host ports `3273`, `4273`, `5273`, and `6353` by default. Inside the Docker network, the containers still listen on `3000`, `4000`, `5000`, and `6080`.

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
