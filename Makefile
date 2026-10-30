# Owelio — common tasks from the repository root (requires make, uv, and npm).
# Run make from this directory. uv is invoked via scripts/uv.sh (Git Bash / Windows PATH).

# Optional: copy .env.local.example to .env.local and set OWELIO_UV=...
ifneq (,$(wildcard .env.local))
include .env.local
export
endif

UV ?= scripts/uv.sh
NPM ?= npm
BACKEND_DIR := backend
API_URL := http://127.0.0.1:8000/api/v1
WEB_URL := http://127.0.0.1:3000

SHELL := bash

.DEFAULT_GOAL := help

.PHONY: help check-tools
help: ## List targets
	@echo "Owelio"
	@echo ""
	@echo "  make install          Backend + frontend dependencies"
	@echo "  make run              API server ($(API_URL))"
	@echo "  make dev              Frontend dev server ($(WEB_URL))"
	@echo "  make dev-fresh        Frontend dev (free port 3000 first)"
	@echo "  make test             Backend and frontend tests"
	@echo "  make check-tools      Show paths for make, uv, npm"
	@echo ""
	@echo "  make install-backend  uv sync --extra dev"
	@echo "  make install-frontend npm install (frontend/)"
	@echo "  make dev-backend      Same as run"
	@echo "  make test-backend     pytest"
	@echo "  make test-frontend    vitest"
	@echo "  make build            Production frontend build"
	@echo "  make lint             ESLint (frontend/)"

check-tools: ## Print tool locations (debug PATH issues)
	@echo "make -> $$(command -v make || echo MISSING)"
	@echo "HOME -> $$HOME  USERPROFILE -> $${USERPROFILE:-<unset>}"
	@echo "uv   -> $(UV)"
	@bash "$(UV)" --version || true
	@echo "npm  -> $$(command -v npm || echo MISSING)"

.PHONY: install install-backend install-frontend
install: install-backend install-frontend ## Install all dependencies

install-backend: ## uv sync in backend/
	bash "$(UV)" sync --extra dev --directory "$(BACKEND_DIR)"

install-frontend: ## npm install in frontend/
	$(NPM) run install:frontend

.PHONY: run dev-backend
run: dev-backend ## Run FastAPI with reload on :8000

dev-backend: ## Run FastAPI with reload on :8000
	bash "$(UV)" run --directory "$(BACKEND_DIR)" uvicorn owelio.main:app --reload --host 127.0.0.1 --port 8000

.PHONY: dev dev-fresh
dev: ## Run Vite/TanStack dev server on :3000
	$(NPM) run dev

dev-fresh: ## Kill stale dev ports, then start frontend
	$(NPM) run dev:fresh

.PHONY: test test-backend test-frontend
test: test-backend test-frontend ## Run all tests

test-backend: ## pytest in backend/
	bash "$(UV)" run --directory "$(BACKEND_DIR)" pytest

test-frontend: ## vitest in frontend/
	$(NPM) test

.PHONY: build lint
build: ## Production build (frontend/)
	$(NPM) run build

lint: ## ESLint (frontend/)
	cd frontend && $(NPM) run lint
