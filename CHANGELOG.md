# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.1.13] — 2026-03-23

### Added
- **Retry on failure** — configurable auto-retry on failed or errored runs; system-wide default (`retryCount` setting, 0 = disabled) with per-test override (0–10 retries); retries are linked via `parent_run_id` and `attempt` counter; retry attempts show an `↺ N` badge in the runs list and run detail page; chain triggers fire only after all retries are exhausted
- **Run queue view** — new `/queue` page showing all pending and running tests in real time (2-second polling); displays test name, status badge, live elapsed timer, attempt/chain badges; sidebar shows a live count badge on the "Run Queue" nav item (5-second poll, only visible when queue is non-empty); `GET /api/runs` now accepts comma-separated `status` values (e.g. `?status=pending,running`)
- **Dependency chaining** — tests can be linked into unlimited sequential chains (A→B→C→D); when a run finishes, outgoing chain links are checked and downstream tests are triggered automatically; per-link `continue_on_failure` toggle controls whether the chain proceeds on failure or stops; cycle detection (BFS) blocks circular links at creation time; chained runs carry `chain_run_id` (anchored to the first run in the chain) and `triggered_by_run_id`; chain badge (`⛓`) shown in runs list and queue; run detail page shows "Triggered by" and "Triggered next" links; `ChainPanel` on the test detail page auto-saves immediately with a transient "Saved" confirmation

### Changed
- Test detail page override grid expanded from 3 to 4 columns to accommodate the new per-test retry override selector

---

## [0.1.12] — 2026-03-23

### Changed
- `.env.example` updated to document all environment variables: `NOVNC_PORT`, `RUNNER_SECRET` (shared secret for backend→runner auth), and `HTTPS_ONLY` (enables Secure cookie flag behind TLS)

---

## [0.1.11] — 2026-03-23

### Fixed
- Auth recording (and codegen) failed after any container restart — Xvfb refused to start because `/tmp/.X99-lock` survived in the container's writable layer; runner startup now removes the stale lock before launching Xvfb

---

## [0.1.10] — 2026-03-23

### Security
- Clamp `?limit` on run list queries to 1–1000 (prevented integer overflow / unbounded DB scan)
- Admin password reset now immediately invalidates the target user's active sessions
- Runner shared-secret authentication — `RUNNER_SECRET` env var; backend passes `Authorization: Bearer` header on all runner calls; runner rejects requests without it when the secret is configured
- Orphaned tests (`user_id = NULL` after owner deletion) are now admin-only; non-admin queries no longer include `OR user_id IS NULL`
- SSE `__unauthorized__` signal now closes the stream and redirects to `/login` instead of being silently swallowed
- Batch user `IN`-clause lookups in test-shares list endpoint (chunks of 100) to stay within SQLite parameter limits
- Replaced `dangerouslySetInnerHTML` theme script with an external `/theme.js` static file

---

## [0.1.9] — 2026-03-23

### Fixed
- Login blocked after clean+build — CSRF origin check now allows both `http://localhost:3000` and `http://127.0.0.1:3000`; previously only the `localhost` form was accepted, so browsers using `127.0.0.1` received a 403 on every login attempt

---

## [0.1.8] — 2026-03-20

### Added
- `tracelab_logo.png` replaces the Zap icon on the login page and in the sidebar; logo is centered in both locations
- Sidebar displays the current version (`v0.1.8`) in small muted text below the logo

### Changed
- ZIP export now includes `script.js` — the exact Playwright script used for the run, sourced from the database at export time
- Login page logo sized at 90×30px; sidebar logo sized at 70×20px

---

## [0.1.7] — 2026-03-20

### Added
- Per-run ZIP export — "Export ZIP" button on the run detail page packages all artifacts (screenshots, video, trace) together with `log.txt` (full execution log) and `run-info.json` (test name, status, timestamps, error message) into a single download; button is only shown once the run has finished; backend uses `spawnSync` with argument arrays (no shell interpolation) and cleans up the temp directory on both stream close and stream error

---

## [0.1.6] — 2026-03-20

### Added
- Per-test headless override — each test has a "Headless" selector (System default / On / Off) that overrides the global headless setting at run time; `headless` column added to the tests table via safe migration
- VNC connect delay — when a headed test run starts, the runner waits 2 seconds after VNC is ready before launching the browser, giving the noVNC client time to connect before anything appears on screen

---

## [0.1.5] — 2026-03-20

### Fixed
- Headed mode (headless OFF) now shows a live browser panel in Docker — the runner starts VNC (x11vnc + websockify) and passes `DISPLAY :99` to the browser before test execution; the run detail page shows an embedded noVNC iframe while the run is active; VNC is stopped cleanly when the run finishes; `vnc_port` is stored in the runs table at start and read by the frontend via the polling interval

---

## [0.1.4] — 2026-03-19

### Fixed
- Replaced all native `confirm()` browser dialogs with a custom in-app confirmation modal — eliminates the browser's "Don't allow prompts" checkbox that could permanently suppress delete confirmations; affects run delete, test delete, test detail delete, auth state delete, user delete, and user disable/enable

---

## [0.1.3] — 2026-03-19

### Fixed
- Auth state recording now shows an in-browser noVNC panel in Docker — the runner starts VNC (x11vnc + websockify) before launching the browser against `DISPLAY :99` and returns `vncPort`; the Auth States page shows the same full-screen noVNC iframe modal used by the codegen recorder; VNC is stopped cleanly when Finish is clicked

---

## [0.1.2] — 2026-03-19

### Added
- Last login timestamp on user records — displayed in the admin Users table as a relative time ("2 hours ago" / "Never")
- Account disable/enable toggle in the admin Users table — disabled users are blocked at login and any active session is immediately invalidated
- Disabled accounts shown with strikethrough username and an orange `disabled` badge

### Fixed
- Shared-test runs returned "Run not found" for the shared user — run access checks and the run list query now include tests shared via `test_shares`
- Screenshots were empty for shared-test runs — artifact access checks now also consult `test_shares`
- All metadata fields (inputs, selects, textarea, checkbox) on the test detail page are now locked to read-only for users with read-only share access
- Primary admin account (earliest-created admin) cannot be disabled — enforced in both the backend API and the UI (button greyed out with tooltip)

---

## [0.1.1] — 2026-03-19

### Added
- Test sharing — test owners and admins can share any test with specific users or with all users of a given role (admin/dev/qa)
- Two permission levels per share: **read-only** (can view script and run the test, cannot edit or delete) and **read-write** (full edit access except delete)
- Sharing panel on the test detail page, visible to the test owner and admins; lists current shares with remove button and an add-share form (user or role picker, permission selector)
- `GET /api/tests/:id/shares`, `POST /api/tests/:id/shares`, `DELETE /api/tests/:id/shares/:shareId` endpoints (owner/admin only)
- `GET /api/users/directory` endpoint — returns all users (id, username, role) for any authenticated user; used to populate the share picker
- `_access` field on the `GET /api/tests/:id` response (`admin` | `owner` | `write` | `read`) so the frontend knows which controls to show
- `test_shares` DB table created on startup (safe no-op migration on existing instances)

### Changed
- Test list query now includes tests shared with the current user or their role
- Monaco editor enters read-only mode when `_access === 'read'`; recorder, save, and delete controls are hidden for read-only viewers

---

## [0.1.0] — 2026-03-19

### Added
- In-browser Playwright codegen recorder — recording now happens inside a full-screen modal within the TraceLab UI via an embedded noVNC browser panel; no desktop window or X11 passthrough required
- `x11vnc` + `websockify` + noVNC installed in the runner image; VNC server starts on-demand when a codegen session begins and shuts down when it ends
- Port 6080 exposed on the runner container for noVNC WebSocket traffic

### Changed
- Runner Dockerfile uses `DEBIAN_FRONTEND=noninteractive` to prevent apt interactive prompts during image builds

### Removed
- X11 host display passthrough and xauth cookie workarounds — no longer needed with the in-browser VNC approach

---

## [0.0.5] — 2026-03-19

### Added
- Multi-browser support — tests can now run in Chromium, Firefox, or WebKit (Safari engine); previously Chromium only
- System-wide default browser setting in Settings — controls which engine is used when a test has no browser override
- Per-test browser override — each test has a "Browser" selector (System default / Chromium / Firefox / WebKit) that takes precedence over the system setting at run time
- Per-test Record Video override — each test has a "Record Video" selector (System default / On / Off) that overrides the global capture setting for that test; null/unset falls back to the system setting
- Database migrations for both new columns (`browser`, `capture_video`) are applied safely on startup — existing databases are upgraded without data loss

---

## [0.0.4] — 2026-03-19

### Added
- Sample test seeded on first install — "DuckDuckGo — Arch Linux search" is pre-loaded under the `sysadmin` account so new users can immediately verify the runner is working without writing any code

### Fixed
- Stale session cookie no longer bypasses the login screen after a data reset or reinstall — middleware clears the cookie on redirect and the sidebar redirects to login on any 401 response

---

## [0.0.3] — 2026-03-19

### Added
- Dark / light mode toggle with persistence via `localStorage`
- Theme-aware CSS custom properties (RGB channel format) backing all design tokens — opacity modifiers (`bg-accent/20`, `border-border/50`, etc.) work correctly in both themes
- Sun / Moon toggle button in the sidebar footer
- Flash-of-unstyled-content (FOUC) prevention — inline script in `<head>` applies the saved theme class before first paint
- Monaco editor switches between `vs-dark` and `vs` themes to match the active mode

### Changed
- All custom Tailwind colors (`bg`, `accent`, `border`, `muted`) now resolve via CSS variables, making them automatically theme-aware across every component with no per-component changes
- Status badges, hardcoded `text-slate-*`, and semantic text colors (`text-red-400`, `text-blue-400`, etc.) remapped to accessible high-contrast values in light mode
- Scrollbar track and thumb colours follow the active theme

---

## [0.0.2] — 2026-03-18

### Added
- Animated running overlay — centered SVG circular lightning bolt displayed during active test runs
- Live elapsed timer on running overlay in `MM:SS.t` format, counting from run start
- `start-docker.sh` — shell script to start (`./start-docker.sh start`) and stop (`./start-docker.sh stop`) the stack, with `--build` and `--logs` flags
- `start-local.sh` — shell script to run the full stack natively without Docker (requires Node.js 22+); auto-installs deps, streams logs, cleans up on Ctrl+C

### Fixed
- Login page now correctly centered in the viewport (was constrained by the app shell layout)
- SVG arc rotation on running overlay now uses `requestAnimationFrame` with direct attribute writes, replacing broken CSS/SMIL approaches that stuttered at the 3 o'clock position

---

## [0.0.1] — 2026-03-18

### Added

#### Platform
- Docker Compose setup with three services: frontend (Next.js), backend (Fastify), runner (Playwright)
- Bind-mounted `./data/` volume for persistent storage across restarts
- `Makefile` with common operations (`up`, `down`, `build`, `logs`, `clean`, `install`, dev targets)

#### Authentication & Users
- Session-based login with httpOnly cookies (`tracelab_session`, 7-day TTL)
- Password hashing via Node.js built-in `crypto.pbkdf2Sync` (PBKDF2-SHA512, 100k iterations)
- Three roles: `admin`, `dev`, `qa`
- Default admin account: `sysadmin` / `qazxsw` — created on first startup
- Per-user data siloing: Dev and QA users only see their own tests, runs, and auth states
- Admin global view: admins can see and manage all data
- Next.js middleware redirecting unauthenticated users to `/login`
- Admin user management UI at `/admin/users` (create, edit role/password, delete)
- Logout button and current user display in sidebar

#### Tests
- Test list with search, app filter, and tag filter
- Monaco-based test editor with syntax highlighting
- Playwright codegen recorder — record actions in a live browser, inject generated script into the editor
- Tags support (comma-separated, displayed as chips)
- Duplicate test action
- Test detail page with run history

#### Test Execution
- Chromium launch via Playwright with configurable settings (headless, slowMo, timeout)
- Script execution via `new Function()` with injected globals: `page`, `context`, `browser`, `takeScreenshot`, `log`
- Per-run artifact directory under `./data/artifacts/<runId>/`
- Automatic failure screenshot on unhandled error

#### Runs
- Run list with status filter and pagination
- Run detail page with stats (status, duration, start/finish times)
- Live log streaming via Server-Sent Events (SSE) during active runs
- Screenshot gallery with lightbox viewer
- Inline video player for `.webm`/`.mp4` recordings with download link
- Error message display for failed runs

#### Artifacts
- Automatic screenshot capture (configurable)
- Video recording support (configurable, saved as `.webm`)
- Trace capture support (configurable)
- File serving endpoint with MIME type detection and path traversal protection

#### Auth States
- Saved browser session management (captures Playwright `storageState`)
- Record new session by launching a headed browser
- Finish recording via UI button (no manual intervention required)
- Refresh existing session
- Auth states can be assigned to tests and reused across runs

#### Settings
- Global execution settings: headless mode, slow motion delay, timeout, screenshot/video/trace capture toggles

#### Dashboard
- Recent runs summary
- Pass/fail status overview

#### Infrastructure
- SQLite via Node.js 22 built-in `node:sqlite` (no native compilation required)
- WAL journal mode and foreign key enforcement
- Schema migration via `ALTER TABLE` with try/catch (safe on existing databases)
- Automatic session cleanup (expired sessions purged hourly)
- Fastify backend with CORS, multipart support
- Runner uses `mcr.microsoft.com/playwright:v1.42.1-jammy` base image with Xvfb for headed mode
- Playwright pinned to exact version `1.42.1` to match runner image
