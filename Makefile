.PHONY: help up down status restart logs explorer railway-rollup-prepare railway-rollup-build

help:
	@echo "LendPay local stack commands"
	@echo "  make up      - start postgres, rollup, backend, frontend, and docs"
	@echo "  make down    - stop stack started by the local scripts"
	@echo "  make status  - show stack status"
	@echo "  make restart - restart the whole stack"
	@echo "  make logs    - show log file locations and postgres log commands"
	@echo "  make explorer - show the local explorer URLs"
	@echo "  make railway-rollup-prepare - stage minitiad + rollup home for Railway Docker deploy"
	@echo "  make railway-rollup-build   - build the Railway rollup Docker image locally"

up:
	@./scripts/local-stack-up.sh

down:
	@./scripts/local-stack-down.sh

status:
	@./scripts/local-stack-status.sh

restart:
	@./scripts/local-stack-down.sh
	@./scripts/local-stack-up.sh

logs:
	@echo "Rollup : ./.run/local-stack/logs/rollup.log"
	@echo "Backend: ./.run/local-stack/logs/backend.log"
	@echo "Frontend: ./.run/local-stack/logs/frontend.log"
	@echo "Docs: ./.run/local-stack/logs/docs.log"
	@echo "Postgres status: docker compose -f docker-compose.local-stack.yml ps"
	@echo "Postgres logs  : docker compose -f docker-compose.local-stack.yml logs -f postgres"

explorer:
	@echo "Explorer UI : http://127.0.0.1:5173/scan.html"
	@echo "Explorer TX : http://127.0.0.1:5173/scan.html?tx=448E7B788606C657BDD7639628F809E1254E7A230AA3D4F053BB51F25A51C9D9"
	@echo "Rollup REST : http://127.0.0.1:1317"

railway-rollup-prepare:
	@./scripts/railway-rollup-prepare.sh

railway-rollup-build:
	@docker build -f deploy/railway/rollup/Dockerfile -t lendpay-rollup-railway .
