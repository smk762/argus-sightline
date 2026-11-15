# Node may not be on the host: every npm task runs in the node image the Dockerfile uses.
NODE_IMAGE ?= node:22.23.4-alpine
NODE_RUN = docker run --rm -u $(shell id -u):$(shell id -g) -e HOME=/tmp -e NEXT_TELEMETRY_DISABLED=1 -v "$(CURDIR)":/app -w /app
NPM = $(NODE_RUN) $(NODE_IMAGE)
COMPOSE_BUILD = docker compose -f compose.yaml -f compose.build.yaml
SURVEY_SRC ?= ../argus-survey

.PHONY: help install check lint typecheck test build wire-check wire-local docs-pull demo-data demo-record tape-data tape pages shared-check up up-published down logs

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

docs-pull:  ## Import argus-survey's docs at the pinned commit into docs/survey/ and record their hashes
	$(NPM) node scripts/docs-pull.mjs

demo-data:  ## Write the synthetic demo kit (known answers) into data/in/kit
	$(COMPOSE_BUILD) --profile kit build survey
	$(COMPOSE_BUILD) --profile kit run --rm kit

demo-record:  ## Record the demo's measured numbers against the running API (README, schema/demo-record.json, pin version)
	$(NODE_RUN) --network host -e ARGUS_SURVEY_URL -e SURVEY_COMMIT=$(shell git -C "$(SURVEY_SRC)" rev-parse HEAD) $(NODE_IMAGE) node scripts/demo-record.mjs

# The hosted demo (sightline.dragonhound.dev): one recorded job on public USGS 3DEP lidar, replayed as static files.
TAPE_EPT = https://s3-us-west-2.amazonaws.com/usgs-lidar-public/USGS_LPC_CA_LosAngeles_2016_LAS_2018/ept.json
TAPE_BOUNDS = ([-13134780, -13134420], [4040300, 4040660])

tape-data:  ## Fetch the hosted demo's public LiDAR (USGS 3DEP) into data/in/usgs-3dep with its polygon and line
	$(COMPOSE_BUILD) --profile kit build survey
	mkdir -p data/in/usgs-3dep
	cp scripts/tape-data/pile.geojson scripts/tape-data/xs1.geojson data/in/usgs-3dep/
	docker run --rm -u $(shell id -u):$(shell id -g) -e HOME=/tmp -v "$(CURDIR)/data/in/usgs-3dep:/out" argus-survey:local \
		pdal translate "$(TAPE_EPT)" /out/site.laz --readers.ept.bounds="$(TAPE_BOUNDS)"

tape:  ## With `make up` running on the pinned survey commit: record the hosted demo's tape into public/data-tape
	$(NODE_RUN) --network host -e ARGUS_SURVEY_URL -e SURVEY_COMMIT=$(shell git -C "$(SURVEY_SRC)" rev-parse HEAD) $(NODE_IMAGE) node scripts/record-tape.mjs

pages:  ## The hosted demo: static export of the tape to out/, with a hash CSP on every page, then the static check
	$(NPM) npm run build:pages

shared-check:  ## The vendored Dragonhound shared layer is unedited and matches the published v1 manifest
	node vendor/dh/sync-shared.mjs --check . --against https://dragonhound.dev/brand/v1/manifest.json --allow-outdated

up:  ## Build $(SURVEY_SRC) and this UI, start both on http://localhost:3107
	$(COMPOSE_BUILD) up -d --build

up-published:  ## Same, with the published argus-survey image
	docker compose up -d --build

down:  ## Stop
	docker compose down

logs:  ## Follow both services
	docker compose logs -f
