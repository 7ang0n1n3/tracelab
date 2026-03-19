#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

info()    { echo -e "${CYAN}[tracelab]${NC} $*"; }
success() { echo -e "${GREEN}[tracelab]${NC} $*"; }
warn()    { echo -e "${YELLOW}[tracelab]${NC} $*"; }
error()   { echo -e "${RED}[tracelab]${NC} $*"; }

# Check requirements
if ! command -v node &>/dev/null; then
  error "Node.js is required but not found. Install Node.js 22+."
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_MAJOR" -lt 22 ]; then
  error "Node.js 22+ is required (found v$(node -e 'process.stdout.write(process.version.slice(1))'))."
  exit 1
fi

if ! command -v npm &>/dev/null; then
  error "npm is required but not found."
  exit 1
fi

# Install dependencies if node_modules are missing
for pkg in backend runner frontend; do
  if [ ! -d "$pkg/node_modules" ]; then
    info "Installing $pkg dependencies..."
    (cd "$pkg" && npm install --silent)
  fi
done

# Ensure data directories exist
mkdir -p data/db data/artifacts data/auth

# Export env vars for local dev
export DATABASE_PATH="$SCRIPT_DIR/data/db/tracelab.db"
export ARTIFACTS_PATH="$SCRIPT_DIR/data/artifacts"
export AUTH_STATE_PATH="$SCRIPT_DIR/data/auth"
export RUNNER_URL="http://localhost:5000"
export PORT_BACKEND="${BACKEND_PORT:-4000}"
export PORT_RUNNER="${RUNNER_PORT:-5000}"

LOG_DIR="$SCRIPT_DIR/.logs"
mkdir -p "$LOG_DIR"

PIDS=()

cleanup() {
  echo ""
  info "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  success "All services stopped."
}
trap cleanup EXIT INT TERM

# Start runner
info "Starting runner on :${PORT_RUNNER}..."
(cd runner && PORT="$PORT_RUNNER" npm run dev) >"$LOG_DIR/runner.log" 2>&1 &
PIDS+=($!)

# Wait for runner to be ready
for i in $(seq 1 20); do
  if curl -sf "http://localhost:${PORT_RUNNER}/health" &>/dev/null; then break; fi
  sleep 0.5
done

# Start backend
info "Starting backend on :${PORT_BACKEND}..."
(cd backend && PORT="$PORT_BACKEND" npm run dev) >"$LOG_DIR/backend.log" 2>&1 &
PIDS+=($!)

# Wait for backend to be ready
for i in $(seq 1 20); do
  if curl -sf "http://localhost:${PORT_BACKEND}/health" &>/dev/null; then break; fi
  sleep 0.5
done

# Start frontend
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
info "Starting frontend on :${FRONTEND_PORT}..."
(cd frontend && PORT="$FRONTEND_PORT" npm run dev) >"$LOG_DIR/frontend.log" 2>&1 &
PIDS+=($!)

# Wait for frontend
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${FRONTEND_PORT}/" &>/dev/null; then break; fi
  sleep 0.5
done

echo ""
success "TraceLab is running."
echo ""
echo -e "  App      ${GREEN}http://localhost:${FRONTEND_PORT}${NC}"
echo -e "  Backend  ${CYAN}http://localhost:${PORT_BACKEND}${NC}"
echo -e "  Runner   ${CYAN}http://localhost:${PORT_RUNNER}${NC}"
echo ""
echo -e "  Login    sysadmin / qazxsw"
echo ""
echo -e "  Logs     ${YELLOW}.logs/frontend.log${NC}"
echo -e "           ${YELLOW}.logs/backend.log${NC}"
echo -e "           ${YELLOW}.logs/runner.log${NC}"
echo ""
info "Press Ctrl+C to stop."
echo ""

# Tail all logs
tail -f "$LOG_DIR/backend.log" "$LOG_DIR/runner.log" "$LOG_DIR/frontend.log" &
PIDS+=($!)

# Wait for any child to exit unexpectedly
wait -n "${PIDS[@]}" 2>/dev/null || true
