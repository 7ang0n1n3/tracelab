# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
