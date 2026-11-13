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

Not checked out? Read https://github.com/smk762/argus-cortex/blob/main/SUITE.md

## Layout

- `src/lib/` holds the pure logic, unit-tested with vitest:
  - `surveyApi.ts`: the one client. Write gating lives here: `runStep` refuses when `/health.read_only`.
  - `sse.ts`: SSE over a POST, since `EventSource` is GET-only.
  - `workflow.ts`: steps, groups and prerequisites. These mirror the server's `require_crs`/`product_path` refusals.
  - `datum.ts`: datum chips and the WA presets.
  - `demoKit.ts`: kit detection and the analytic truths.
  - `geo.ts`: approximate lengths and areas while drawing, never for deliverables.
  - `format.ts`, `runtimeConfig.ts`, `theme.ts`.
- `src/lib/generated/survey.ts` is **generated** from `schema/survey-wire.schema.json`, pinned in `schema/pins.json`, by `scripts/wire-types.mjs` (studio's tool plus `--local`). Never hand-edit it. When argus-survey's models change: run `argus-survey schema` there, then `make wire-local` here, then fix what tsc reports. Once survey tags a release, set the pin's tag and use `npm run wire:pull`. A `"tag": "local"` pin is for unreleased work only.
- **Sync record** (argus-sightline#7, the argus-studio#169 sync rule): `schema/pins.json`'s survey entry pins survey's `dev` commit (`tag`, a full sha), its `version` and, once docs are imported, a sha256 per file under `docs/survey/` (`docs`). `schema/demo-record.json` and the README's demo table (between `demo-record` markers) are written by `make demo-record` against a stack built from that commit; `src/lib/sync.test.ts` fails `make check` when any of them disagree. `.github/workflows/survey-drift.yml` opens an issue when survey `dev` moves. Build survey for a recording from a *clone* at the commit, not a worktree: hatch-vcs needs a real `.git` in the build context.
- `src/lib/surveyDocs.ts` is the one table of survey docs links (steps, datum chips, demo truths), at the pinned commit. `src/lib/provenance.ts` builds the "Made with" line from `job.json`.
- `src/components/workspace/` is the job workspace:
  - `Workspace.tsx` holds the state, the context and `run()`, which streams into the console and refreshes the sidecar.
  - Also here: `StepRail`, `MapView`, `PointView`, `Console`, `DatumChips`.
  - `panels/` has one panel per step, grouped by capture/model/measure/deliver.
- `src/components/Dashboard.tsx`: the home page (jobs, demo card, toolchain).

## Gotchas

- **Config is read per request** (studio#56): `layout.tsx` is `force-dynamic` and injects `window.__SIGHTLINE_ENV__`. Never read config at client module scope; call `surveyUrl()` at use time.
- **maplibre-gl.css sets `.maplibregl-map { position: relative }` unlayered**, which beats Tailwind's layered utilities. The map container therefore uses an *inline* `position:absolute; inset:0`. With a class, the map collapses to zero height.
- **Below `lg` the map pane needs an explicit height** (`h-[62vh]`). A min-height alone leaves the `h-full` grid inside it at 0.
- **Layer loading fetches every view first, then swaps layers synchronously.** Products and `mapVersion` change together after a step, so an interleaved async load would `addSource` an id twice.
- Map views are cached server-side by product SHA plus `VIEW_VERSION`. Image URLs carry `?v=<png name>` to bust the browser cache.
- MapLibre stays on **5.x** (6 is ESM-only; see argus-survey's CLAUDE.md). It is bundled from npm here, not loaded from a CDN. `laz-perf.wasm` is copied into `public/` by `postinstall` (`scripts/copy-wasm.mjs`) and served from our own origin.
- **Stockpiles and change belong on the DSM.** The ground filter removes a pile from the DTM, which reads ~10 % low on the demo cone. The panels default to the DSM and say why.
- npm 10's arborist crashes (`edgesOut`) when resolving vitest 4's optional peers from scratch. The lockfile was seeded from argus-studio's. If you ever re-resolve, start from an existing lock.
- Port 3000 is often taken locally (argus-studio, argus-cull). This UI uses 3107 and argus-survey's CORS default is `localhost:3000`, so compose sets `SURVEY_CORS_ORIGINS`.

- **The CSP is strict and nonce-based** (`src/proxy.ts`, `src/lib/csp.ts`). A new inline `<script>` needs `nonce` from `headers().get("x-nonce")`, as in `layout.tsx`. Anything a nonced script loads is trusted (`'strict-dynamic'`). MapLibre needs `worker-src blob:` and laz-perf needs `'wasm-unsafe-eval'`. Watch for `securitypolicyviolation` in the headless check.
- **Map keyboard handlers ignore editable targets.** Backspace in a field must not undo a vertex. Keep new map shortcuts behind `isEditable()`.
- **Field errors go through `<Field error>`**, which sets `aria-invalid`, links the error only while it is shown and announces it via `announce()`. Don't make an error message its own live region.

## Web platform guidance

Frontend work here follows Modern Web Guidance (GoogleChrome/modern-web-guidance). In Claude Code it is the `modern-web-guidance` plugin skill; elsewhere, run `npx modern-web-guidance@latest install`. Search it before building a UI pattern. House exceptions:

- **Reduced motion is per rule, never global.** Wrap decorative animation in `@media (prefers-reduced-motion: no-preference)`. Progress indicators (`.sweep`, `Spinner`) slow down under `reduce` rather than stop. MapLibre already skips its camera animations under `reduce`.
- **Long loops yield** through `yieldToMain()` (`src/lib/yieldToMain.ts`, `scheduler.yield` with a `setTimeout` fallback) on a 50 ms budget.
- `legacy-scan src` was clean at adoption (2026-11-12), so there are no skipped findings to record.

## Checking a change

`make check` and `make build`, then `make up` and drive it in headless Chrome: `zenika/alpine-chrome:with-puppeteer` with `--network host --use-angle=swiftshader --enable-unsafe-swiftshader`. Both the map and the point view render under swiftshader. Click steps by button text and wait for the `.sweep` progress bar to disappear.

## Conventions

- Publishing (GitHub, GHCR) is the owner's (smk762) job. Branch rules are under Branches below.
- Don't add dependencies beyond next/react/maplibre-gl/three/copc/laz-perf without asking. No server-side proxy: the browser calls the API directly (CORS), as in argus-studio.

## Branches

`dev` is the default branch and the base for every PR. Cut feature branches from `origin/dev` and bring them up to date by merging `origin/dev`, never `main`. Never push work to `main` or open a PR against it, except the release PR from `dev`: `main` must never be ahead of `dev`, with one exception. A release fast-forwards `main` to a `dev` commit that passed CI (`git push origin origin/dev:main`), then tags it. If `main` is protected, the release is a reviewed PR from `dev` into `main`, and merging it leaves a merge commit on `main` alone. That merge commit is the one exception to the rule: it leaves `main` one commit ahead of `dev` with an identical tree. Leave it there and don't merge `main` back into `dev`. Anything else on `main` that `dev` lacks is a mistake (`git diff origin/dev origin/main` must be empty). Once `main` carries such a commit it can't be fast-forwarded, so later releases are PRs too.
