# CLAUDE.md — argus-sightline

Orientation for agents. Usage lives in [README.md](README.md).

## What this is

A Next.js 16 / React 19 / Tailwind v4 client for the **argus-survey** API (:8107, repo `../argus-survey`). It is the full-feature demo and workspace for that package. argus-studio (`../argus-vision-demo`) links to it rather than embedding it. **No processing, datum logic or file paths here.** The server is the authority; this UI names inputs under `SURVEY_DATA_DIR` (as `/inputs` lists them), runs steps over SSE, and renders `job.json` plus the API's derived map views. The UI port is **3107**.

## Argus suite
<!-- argus-suite: keep this block; argus-ci checks for it -->
This repo is part of the Argus suite. The suite map below lists every sibling and what it owns; check it before
building something a sibling may already do. **On every release, update this repo's row and capabilities in
argus-cortex's SUITE.md** (a PR to argus-cortex in the same release).

@../argus-core/SUITE.md

Not checked out? Read https://github.com/smk762/argus-cortex/blob/dev/SUITE.md

## Must never happen

Each rule names what fails when it is broken. **UNENFORCED** rows link the issue that adds a check. A rule about code shape can instead go in argus-ci's suite-rules catalogue (smk762/argus-ci#16).

| Must never happen | Enforced by |
|---|---|
| Processing, datum logic or file paths in the UI: the server is the authority, and inputs are names from `/inputs` | **UNENFORCED**: #36 |
| The demo tape (`public/data-tape/`) holds anything but public data (USGS 3DEP), such as a client's survey | `src/lib/tapeProvenance.test.ts:52-111`: every input in `inputs.json`, each step's request and `job.json` is a file of an allowlisted public dataset; the Makefile's source and tile match |
| `runStep` POSTs to a read-only server (`/health.read_only`) | live: `src/lib/surveyApi.test.ts:72-106`; hosted demo: `src/lib/static.test.ts:102` |
| `src/lib/generated/survey.ts` is hand-edited | CI `npm run wire:check` (`.github/workflows/ci.yml:23-24`; `make check`) |
| `docs/survey/` is hand-edited | `src/lib/sync.test.ts:63-77` (pinned hashes, no unpinned file) |
| Imported docs carry a private IP, a home path or an email address | opsec gate in `scripts/docs-pull.mjs:43,79-84`, at import time only |
| Config is read at client module scope (call `surveyUrl()` at use time) | `src/lib/rules.test.ts:40-43`; `process.env` readers pinned at `:45-48` |
| Code branches on runtime state instead of `staticDemo()` | Partial: `src/lib/rules.test.ts:45-48` (no new env switch); runtime-state branches **UNENFORCED**: #38 |
| `geo.ts` lengths or areas feed a deliverable (they are approximate, for drawing) | `src/lib/rules.test.ts:52-55` (who may call `lineLength`/`ringArea`) |
| A map shortcut fires in an editable target (Backspace in a field undoes a vertex) | `src/lib/rules.test.ts:59-63` (page-wide key listeners call `isEditable()`) |
| The CSP loosens (`'unsafe-inline'`, no nonce, a page without CSP) | `src/lib/csp.test.ts:5`, `src/lib/pagesCsp.test.ts:5,16`, `scripts/check-static.mjs:31` |
| The static export ships an API route or points at an API | `scripts/check-static.mjs:24,32-33` (CI `build:pages`, `ci.yml:30`) |
| `vendor/dh/` is edited | CI `dh-shared` (`ci.yml:35-43`); `public/dh-theme.js` copy: `src/lib/shared.test.ts:42` |
| A dependency beyond next/react/maplibre-gl/three/copc/laz-perf/marked is added without asking | `src/lib/rules.test.ts:21-26` |
| A server-side proxy to the API (the browser calls it directly, over CORS) | `src/lib/rules.test.ts:30-36` (no route but the docs images, no rewrites) |
| The lockfile is re-resolved from scratch (npm 10 crashes on vitest 4's optional peers; it was seeded from argus-studio's, so start from an existing lock) | Partial: `npm ci` (`ci.yml:22`) refuses a lock out of step with `package.json`; a regenerated lock **UNENFORCED**: #37 |

## Layout

- `src/lib/` holds the pure logic (vitest); `src/components/workspace/` the job workspace, one panel per step under `panels/`.
- `src/lib/generated/survey.ts` is generated from `schema/survey-wire.schema.json`, pinned in `schema/pins.json`, by `scripts/wire-types.mjs` (studio's tool plus `--local`). When argus-survey's models change: run `argus-survey schema` there, then `make wire-local` here, then fix what tsc reports. Once survey tags a release, set the pin's tag and use `npm run wire:pull`. A `"tag": "local"` pin is for unreleased work only.
- **Sync record** (argus-sightline#7, the argus-studio#169 sync rule): `schema/pins.json`'s survey entry pins survey's `dev` commit (`tag`, a full sha), its `version` and, once docs are imported, a sha256 per file under `docs/survey/` (`docs`). `schema/demo-record.json` and the README's demo table (between `demo-record` markers) are written by `make demo-record` against a stack built from that commit; `src/lib/sync.test.ts` fails `make check` when any of them disagree. `.github/workflows/survey-drift.yml` opens an issue when survey `dev` moves. Build survey for a recording from a *clone* at the commit, not a worktree: hatch-vcs needs a real `.git` in the build context.
- **Survey docs** (argus-sightline#7, #23): `make docs-pull` imports survey's README and `docs/*.md` (plus any `docs/img/*` they show) at the pin's commit into `docs/survey/`, after an opsec gate, and writes their hashes into the pin. `src/lib/surveyDocs.ts` is the one table of docs links (steps, datum chips, demo truths, methods, refusals) and resolves links inside the docs. `src/lib/surveyMarkdown.ts` renders them with `marked` (raw HTML dropped). `/docs/survey/[[...slug]]` reads the files at request time, so `next.config.ts` traces them into the standalone build. survey's `tests/test_docs.py` lists every anchor Sightline links. A new anchor in `SECTIONS` needs a PR there too.

## Gotchas

- **Config is read per request** (studio#56): the layout injects `window.__SIGHTLINE_ENV__`.
- **maplibre-gl.css sets `.maplibregl-map { position: relative }` unlayered**, which beats Tailwind's layered utilities. The map container therefore uses an *inline* `position:absolute; inset:0`. With a class, the map collapses to zero height.
- **Below `lg` the map pane needs an explicit height** (`h-[62vh]`). A min-height alone leaves the `h-full` grid inside it at 0.
- **Layer loading fetches every view first, then swaps layers synchronously.** Products and `mapVersion` change together after a step, so an interleaved async load would `addSource` an id twice.
- Map views are cached server-side by product SHA plus `VIEW_VERSION`. Image URLs carry `?v=<png name>` to bust the browser cache.
- MapLibre stays on **5.x** (6 is ESM-only; see argus-survey's CLAUDE.md). It is bundled from npm here, not loaded from a CDN. `laz-perf.wasm` is copied into `public/` by `postinstall` (`scripts/copy-wasm.mjs`) and served from our own origin.
- **Stockpiles and change belong on the DSM.** The ground filter removes a pile from the DTM, which reads ~10 % low on the demo cone. The panels default to the DSM and say why.
- Port 3000 is often taken locally (argus-studio, argus-cull). This UI uses 3107 and argus-survey's CORS default is `localhost:3000`, so compose sets `SURVEY_CORS_ORIGINS`.

- **The CSP is strict and nonce-based** (`src/proxy.live.ts`, `src/lib/csp.ts`). A new inline `<script>` needs `nonce` from `headers().get("x-nonce")`, as in `layout.tsx`. Anything a nonced script loads is trusted (`'strict-dynamic'`). MapLibre needs `worker-src blob:` and laz-perf needs `'wasm-unsafe-eval'`.
- **Field errors go through `<Field error>`**, which sets `aria-invalid`, links the error only while it is shown and announces it via `announce()`. Don't make an error message its own live region.

## Web platform guidance

Frontend work here follows Modern Web Guidance (GoogleChrome/modern-web-guidance). In Claude Code it is the `modern-web-guidance` plugin skill; elsewhere, run `npx modern-web-guidance@latest install`. Search it before building a UI pattern. House exceptions:

- **Reduced motion is per rule, never global.** Wrap decorative animation in `@media (prefers-reduced-motion: no-preference)`. Progress indicators (`.sweep`, `Spinner`) slow down under `reduce` rather than stop. MapLibre already skips its camera animations under `reduce`.
- **Long loops yield** through `yieldToMain()` (`src/lib/yieldToMain.ts`, `scheduler.yield` with a `setTimeout` fallback) on a 50 ms budget.
- `legacy-scan src` was clean at adoption (2026-11-12), so there are no skipped findings to record.

## The hosted demo (sightline.dragonhound.dev)

- **Two builds from one tree.** `npm run build` is the live standalone server. `make pages` (`npm run build:pages`, `SIGHTLINE_STATIC=1`) is a pure static export to `out/` that replays the recorded tape in `public/data-tape/` and calls no API. `staticDemo()` (`src/lib/demo.ts`) is a build-time constant; branch on it, never on runtime state.
- **Live-only files are named `*.live.ts`**: `src/proxy.live.ts` (the nonce CSP) and the docs image route. Only the live build's `pageExtensions` treat them as routes. A route-segment export can't depend on env (Next wants literals), so the live layout is dynamic through its `headers()` call, not `force-dynamic`, and `generateStaticParams` is exported only in the static build (`staticDemo() ? fn : undefined`): with it, the live prerender fails on `headers()`.
- **The data layer is one seam**: `surveyApi.ts` hands every call to `staticApi.ts` in the demo. Running a step replays its recorded events (`tape.ts`, gaps capped at 350 ms); a step the tape lacks says why in its panel (`NOT_RECORDED` in `demo.ts`). Products left out of the tape show without a link (`hasProduct`).
- **CSP** for the export is `scripts/csp.mjs`: hashes of each page's inline scripts in a `<meta>`, `/dh-theme.js` added blocking, `_headers` for frame-ancestors and a sandboxed policy on the tape's files. No Trusted Types: MapLibre 5 writes controls through `innerHTML` and the docs render through `dangerouslySetInnerHTML`. `scripts/check-static.mjs` fails the build on a missing CSP, an API reference or a missing tape file.
- **Shared layer**: `vendor/dh/` is dh-shared, vendored unchanged (`make shared-check`; CI's `dh-shared` job). The demo renders the family strip (`DemoStrip`, `data-dh-site="sightline"`) and uses `dh-theme.js` for light/dark in both builds; `public/dh-theme.js` is a copy (`src/lib/shared.test.ts`). The UI keeps its own palette.

## Checking a change

`make check` and `make build`, then drive it in headless Chrome. The browser setup, recording the tape and the hosted demo's browser check are in [docs/runbook.md](docs/runbook.md).

## Conventions

- Publishing (GitHub, GHCR) is the owner's (smk762) job. Branch rules are under Branches below.

## Branches

`dev` is the default branch and the base for every PR. Cut feature branches from `origin/dev` and bring them up to date by merging `origin/dev`, never `main`. Never push work to `main` or open a PR against it, except the release PR from `dev`: `main` must never be ahead of `dev`, with one exception. A release fast-forwards `main` to a `dev` commit that passed CI (`git push origin origin/dev:main`), then tags it. If `main` is protected, the release is a reviewed PR from `dev` into `main`, and merging it leaves a merge commit on `main` alone. That merge commit is the one exception to the rule: it leaves `main` one commit ahead of `dev` with an identical tree. Leave it there and don't merge `main` back into `dev`. Anything else on `main` that `dev` lacks is a mistake (`git diff origin/dev origin/main` must be empty). Once `main` carries such a commit it can't be fast-forwarded, so later releases are PRs too.
