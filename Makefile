.PHONY: help up down status restart logs

help:
	@echo "LendPay local stack commands"
	@echo "  make up      - start rollup, backend, and frontend"
	@echo "  make down    - stop stack started by the local scripts"
	@echo "  make status  - show stack status"
	@echo "  make restart - restart the whole stack"
	@echo "  make logs    - show log file locations"

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
