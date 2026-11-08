# Node may not be on the host: every npm task runs in the node image the Dockerfile uses.
NODE_IMAGE ?= node:22.23.4-alpine
NODE_RUN = docker run --rm -u $(shell id -u):$(shell id -g) -e HOME=/tmp -e NEXT_TELEMETRY_DISABLED=1 -v "$(CURDIR)":/app -w /app
NPM = $(NODE_RUN) $(NODE_IMAGE)
COMPOSE_BUILD = docker compose -f compose.yaml -f compose.build.yaml
SURVEY_SRC ?= ../argus-survey

.PHONY: help install check lint typecheck test build wire-check wire-local demo-data up up-published down logs

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install:  ## npm ci (also copies laz-perf.wasm into public/)
	$(NPM) npm ci

check: wire-check lint typecheck test  ## Everything CI runs except the build

lint:  ## eslint
	$(NPM) npx eslint

typecheck:  ## tsc --noEmit
	$(NPM) npx tsc --noEmit

test:  ## vitest (pure logic in src/lib)
	$(NPM) npx vitest run

build:  ## next build (standalone)
	$(NPM) npx next build

wire-check:  ## Generated types match the pinned schema
	$(NPM) node scripts/wire-types.mjs --check

wire-local:  ## Re-pin the schema from $(SURVEY_SRC) and regenerate types
	$(NODE_RUN) -v "$(abspath $(SURVEY_SRC))":/survey:ro $(NODE_IMAGE) node scripts/wire-types.mjs --local /survey

demo-data:  ## Write the synthetic demo kit (known answers) into data/in/kit
	$(COMPOSE_BUILD) --profile kit build survey
	$(COMPOSE_BUILD) --profile kit run --rm kit

up:  ## Build $(SURVEY_SRC) and this UI, start both on http://localhost:3107
	$(COMPOSE_BUILD) up -d --build

up-published:  ## Same, with the published argus-survey image
	docker compose up -d --build

down:  ## Stop
	docker compose down

logs:  ## Follow both services
	docker compose logs -f
