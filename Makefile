.PHONY: help help-deploy up down status restart logs explorer railway-deploy-prepare railway-deploy-build

help:
	@echo "LendPay local stack commands"
	@echo "  make up      - start postgres, rollup, backend, frontend, and docs"
	@echo "  make down    - stop stack started by the local scripts"
	@echo "  make status  - show stack status"
	@echo "  make restart - restart the whole stack"
	@echo "  make logs    - show log file locations and postgres log commands"
	@echo "  make explorer - show the local explorer URLs"
	@echo "  make help-deploy - show Railway deploy helpers"

help-deploy:
	@echo "LendPay Railway deploy helpers"
	@echo "  make railway-deploy-prepare - stage minitiad + rollup home for Railway Docker deploy"
	@echo "  make railway-deploy-build   - build the Railway Docker image locally"

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
	@bash -lc 'source ./scripts/local-stack-common.sh; load_backend_env; if manage_local_postgres; then echo "Postgres status: docker compose -f docker-compose.local-stack.yml ps"; echo "Postgres logs  : docker compose -f docker-compose.local-stack.yml logs -f postgres"; else echo "Postgres target: $$(postgres_target_summary)"; echo "Postgres logs  : external service"; fi'

explorer:
	@echo "Explorer UI : http://localhost:5173/scan.html"
	@echo "Explorer TX : http://localhost:5173/scan.html?tx=448E7B788606C657BDD7639628F809E1254E7A230AA3D4F053BB51F25A51C9D9"
	@echo "Rollup REST : http://localhost:1317"

railway-deploy-prepare:
	@./scripts/railway-deploy-prepare.sh

railway-deploy-build:
	@docker build -f deploy/railway/deploy/Dockerfile -t lendpay-railway-deploy .
