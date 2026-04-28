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

usage() {
  echo "Usage: ./start-docker.sh <command> [options]"
  echo ""
  echo "Commands:"
  echo "  start          Start all services (default)"
  echo "  stop           Stop all services"
  echo ""
  echo "Options (start only):"
  echo "  --build, -b    Rebuild images before starting"
  echo "  --logs,  -l    Follow logs after start"
}

# Check requirements
if ! command -v docker &>/dev/null; then
  error "Docker is required but not found."
  exit 1
fi

if ! docker compose version &>/dev/null 2>&1; then
  error "Docker Compose (v2) is required."
  exit 1
fi

COMMAND="${1:-start}"
shift || true

case "$COMMAND" in
  start)
    BUILD=false
    FOLLOW=false
    for arg in "$@"; do
      case $arg in
        --build|-b) BUILD=true ;;
        --logs|-l)  FOLLOW=true ;;
        --help|-h)  usage; exit 0 ;;
      esac
    done

    mkdir -p data/db data/artifacts data/auth

    FRONTEND_PORT="${FRONTEND_PORT:-3273}"
    BACKEND_PORT="${BACKEND_PORT:-4273}"
    RUNNER_PORT="${RUNNER_PORT:-5273}"

    if [ "$BUILD" = true ]; then
      info "Building images..."
      docker compose build
    fi

    info "Starting TraceLab..."
    docker compose up -d

    info "Waiting for services to be ready..."
    for i in $(seq 1 30); do
      if docker compose exec -T backend node -e \
        "require('http').get('http://localhost:4000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" \
        &>/dev/null 2>&1; then
        break
      fi
      sleep 1
    done

    echo ""
    success "TraceLab is running."
    echo ""
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps
    echo ""
    echo -e "  App      ${GREEN}http://localhost:${FRONTEND_PORT}${NC}"
    echo -e "  Backend  ${CYAN}http://localhost:${BACKEND_PORT}${NC}"
    echo -e "  Runner   ${CYAN}http://localhost:${RUNNER_PORT}${NC}"
    echo ""
    echo -e "  Login    sysadmin / qazxsw"
    echo ""
    echo -e "  Logs     ${YELLOW}docker compose logs -f${NC}"
    echo -e "  Stop     ${YELLOW}./start-docker.sh stop${NC}"
    echo ""

    if [ "$FOLLOW" = true ]; then
      info "Following logs (Ctrl+C to detach — containers keep running)..."
      echo ""
      exec docker compose logs -f
    fi
    ;;

  stop)
    info "Stopping TraceLab..."
    docker compose down
    success "All services stopped."
    ;;

  --help|-h|help)
    usage
    ;;

  *)
    error "Unknown command: $COMMAND"
    echo ""
    usage
    exit 1
    ;;
esac
