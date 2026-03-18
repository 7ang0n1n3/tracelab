.PHONY: up down build logs ps restart clean

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

ps:
	docker compose ps

restart:
	docker compose restart

clean:
	docker compose down -v
	rm -rf data/db/* data/artifacts/* data/auth/*

dev-backend:
	cd backend && npm run dev

dev-runner:
	cd runner && npm run dev

dev-frontend:
	cd frontend && npm run dev

install:
	cd backend && npm install
	cd runner && npm install
	cd frontend && npm install
