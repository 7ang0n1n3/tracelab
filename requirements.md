# Requirements Document
## Project: Tangonine Internal GUI Testing Stack

### 1. Overview
Build an internal web application testing platform for a personal lab environment ("tangonine-style") that provides a simple GUI-driven workflow for recording, managing, executing, and reviewing browser-based system tests.

The platform should allow a user to:
- record browser actions visually
- save and organize tests
- execute tests through a Playwright backend
- review results in an HTML-style dashboard
- run everything in Docker
- reuse authenticated sessions to avoid repeated logins

This is intended for internal lab use, not a public SaaS product.

---

### 2. Goal
Create a self-hosted, lightweight QA platform that combines:
- a visual test recorder
- a Playwright execution engine
- a results/reporting dashboard
- Docker-based deployment
- session persistence for authenticated test runs

The end result should feel like a simple internal QA tool that is easy to operate from a browser.

---

### 3. Primary Use Cases
1. Record a login and navigation flow for a web application.
2. Save recorded flows as reusable Playwright tests.
3. Run tests on demand from a GUI.
4. View screenshots, logs, pass/fail status, and run history.
5. Reuse login/auth state between runs.
6. Run the stack locally in Docker or Docker Compose.
7. Support future expansion for multiple apps under test.

---

### 4. Functional Requirements

#### 4.1 Visual Recorder
The platform must provide a GUI-based recording capability that:
- opens a browser session for recording
- captures clicks, text entry, and navigation steps
- converts recorded actions into Playwright-compatible test code
- allows naming and saving recorded tests
- supports editing recorded steps after capture
- allows insertion of waits, screenshots, and assertions
- allows replay of a recorded flow before saving

Preferred behavior:
- recorder output should be human-readable
- selectors should prefer stable locators where possible
- user should be able to adjust selectors manually in the GUI if needed

---

#### 4.2 Test Management UI
The platform must provide a GUI for managing tests, including:
- list of saved tests
- test names and descriptions
- grouping by application/system under test
- create, edit, duplicate, delete, and run actions
- tagging or categorization
- search/filter capability

Each test should store:
- test name
- app/system name
- base URL
- Playwright script
- optional notes
- created date
- updated date

---

#### 4.3 Playwright Backend
The backend must:
- execute saved Playwright tests
- support headed and headless mode
- support configurable slow motion delay
- support configurable timeouts
- capture screenshots during or after steps
- support video and trace capture as optional features
- return structured run results to the UI
- support running one test or a suite of tests

The system should support:
- TypeScript or JavaScript Playwright tests
- parameterized test execution where appropriate
- environment-based configuration

---

#### 4.4 HTML Report Dashboard
The platform must provide a results dashboard that shows:
- test run history
- pass/fail result
- start/end time
- duration
- screenshots captured during execution
- logs/output
- failed step details
- links to Playwright HTML report artifacts if generated

Preferred dashboard views:
- summary page with latest runs
- per-test history page
- per-run detail page
- screenshot gallery per run

Nice-to-have:
- trace viewer integration
- downloadable run artifact bundle
- trend summary (pass rate over time)

---

#### 4.5 Dockerized Test Runner
The system must run in Docker and support Docker Compose.

It should include:
- frontend container
- backend/API container
- Playwright runner container
- persistent storage for tests, reports, screenshots, and session state

Requirements:
- easy local startup with one command
- persistent volumes for reports and test definitions
- ability to update containers without losing test data
- clear environment variable configuration

Preferred:
- support for Chromium at minimum
- optional support for Firefox and WebKit later

---

#### 4.6 Auth Session Reuse
The system must support saving and reusing authenticated browser sessions.

Capabilities:
- save Playwright storage state after login
- associate storage state with a target app/environment
- reuse saved auth state for future test runs
- refresh or replace expired auth state
- allow disabling auth reuse per test if desired

Security expectations:
- stored auth/session data must not be exposed in plaintext in the GUI
- credentials should not be hardcoded into scripts by default
- secrets should be stored using environment variables or a secure local secret mechanism

---

### 5. Non-Functional Requirements

#### 5.1 Usability
- UI should be simple and fast
- internal-lab friendly, not overengineered
- minimal clicks to record and run a test
- clear visual feedback for running, passed, and failed tests

#### 5.2 Reliability
- test execution should be stable and resilient
- logs must be preserved for troubleshooting
- recorder-generated scripts should be editable to reduce flaky behavior

#### 5.3 Maintainability
- clean modular codebase
- easy to extend with new features
- separated frontend, backend, and runner responsibilities
- straightforward config management

#### 5.4 Portability
- must run in a Linux-based lab environment
- should work well with Docker on Arch Linux or similar environments
- deployment should not require Kubernetes

---

### 6. Suggested Technical Architecture

#### 6.1 Frontend
Possible stack:
- React or Next.js frontend
- simple dashboard-style UI
- forms for test editing and run control

#### 6.2 Backend/API
Possible stack:
- Node.js backend
- REST API or lightweight server
- endpoints for tests, runs, reports, auth state, and settings

#### 6.3 Test Runner
- Playwright-based execution service
- isolated run execution
- artifact generation to mounted volumes

#### 6.4 Storage
Use simple persistent storage such as:
- SQLite or Postgres for metadata
- local filesystem volumes for scripts, screenshots, traces, videos, and reports

Suggested separation:
- metadata DB
- artifacts folder
- auth state folder
- test definitions folder

---

### 7. Minimum Viable Product (MVP)
The first usable version should include:

1. GUI page to create and save tests
2. Ability to paste or edit Playwright scripts
3. Button to run a test
4. Backend to execute Playwright tests
5. Screenshot capture and run logs
6. Basic HTML dashboard showing pass/fail history
7. Docker Compose deployment
8. Auth storage state save/reuse

For MVP, the visual recorder may be implemented as one of:
- embedded Playwright codegen workflow
- import of recorded output
- simple manual recorder assistant
- browser automation helper UI

---

### 8. Nice-to-Have Features
These are not required for MVP but desirable:
- browser-based step editor
- drag-and-drop test step ordering
- cron/scheduled test runs
- email or webhook notifications
- multi-user support
- role-based access
- test data variables and templates
- environment switching (dev/test/prod)
- visual diff testing
- suite execution and dependency chaining
- export/import test packages
- dark-mode cyberpunk/tangonine-themed UI

---

### 9. Security Requirements
- do not hardcode usernames/passwords into test files by default
- support environment variables for secrets
- isolate stored session/auth files
- protect sensitive config in Docker environment files
- mask secret values in logs and UI
- provide a way to rotate auth/session state

---

### 10. Deliverables Expected
Claude should produce:

1. Solution architecture
2. Recommended tech stack
3. Project folder structure
4. Docker Compose design
5. Backend API design
6. Frontend page/component plan
7. Playwright runner design
8. Auth storage/reuse design
9. MVP implementation roadmap
10. Starter code or scaffolding for the platform

---

### 11. Output Expectations for Claude
Please generate the response in the following structure:

1. Executive summary
2. Proposed architecture
3. Recommended stack with rationale
4. Folder structure
5. Docker Compose design
6. Backend API endpoints
7. Frontend pages and components
8. Playwright execution flow
9. Auth/session reuse design
10. MVP delivery plan in phases
11. Risks and mitigation
12. Optional future enhancements

Where useful, include:
- example directory trees
- example Docker Compose YAML
- example API route definitions
- example database schema
- example Playwright runner flow

---

### 12. Design Style Preference
The UI should feel like an internal technical operations platform:
- clean
- fast
- dark-mode friendly
- minimal but polished
- dashboard-oriented
- suitable for a personal lab / internal admin tool

A subtle cyberpunk / tangonine-inspired theme is welcome, but function is more important than visual flash.

---

### 13. Constraints
- self-hosted
- Docker-first
- Linux-friendly
- no dependency on heavy enterprise platforms
- should remain understandable and maintainable by one technical operator
- optimized for browser/system testing, especially login and navigation flows

---

### 14. Success Criteria
The project is successful if a user can:
1. open the GUI
2. define or record a browser test
3. save the test
4. run it from the UI
5. reuse a saved authenticated session
6. view screenshots and pass/fail results in a dashboard
7. operate the full stack from Docker Compose
