# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0] - 2026-11-19

### Added
- A hosted demo build (`make pages`, `SIGHTLINE_STATIC=1`): a pure static export that replays one argus-survey job recorded on public USGS 3DEP lidar (`public/data-tape/`, `make tape-data` and `make tape`), with a hash-based CSP on every page (`scripts/csp.mjs`) and a check that the export is static, carries the CSP and has every tape file (`scripts/check-static.mjs`). Running a step replays its recorded console; cut/fill, change and accuracy say what they would need. CI builds it.
- The Dragonhound shared layer (dh-shared 1.2.8, `vendor/dh/`) with a drift check in CI. The hosted demo carries the family strip (`data-dh-site="sightline"`, Sightline's own link marked current since 1.2.5).
- `scripts/demo-e2e.mjs`: the hosted demo in a browser at 1440 and 390 px, light and dark, failing on any console error, failed request or CSP violation (Next.js prefetches cancelled by a navigation do not count).

- A docs page at `/docs/survey`: argus-survey's README and reference docs imported at the synced commit (`make docs-pull`), headed with the survey version and short sha, with GitHub and PyPI links. Links between survey's docs stay on the page; other links open in a new tab, and images are served from this origin. A Docs entry is in the header (#7).
- In-context help to the new reference sections: each step panel to its `docs/steps.md` section, the datum chips to survey's datum rules (an assumed or missing datum to why it's red), the demo's truth rows to the demo kit, the volume base picker to the volume bases, the accuracy class to NVA/VVA, the "Made with" line to what `job.json` records, and a refusal to reading refusals (#23).
- `make check` also fails when a file under `docs/survey/` is not in the sync record.
- README links this UI's row in the suite's [What to run for which UI](https://docs.dragonhound.dev/setup/which-services/#sightline) matrix.

### Changed
- The suite's styling: every UI colour is now a dh-shared token (`vendor/dh/dh-tokens.css`) in light and dark, with the family accent, status inks and system fonts in place of the old orange-and-graphite palette and Geist (whose light-mode orange was 3.6:1 on white). Text meets 4.5:1 and control outlines 3:1 in both schemes; colours that encode data (point classes, raster ramps, map overlays) are unchanged. Light is the default without a saved choice or system preference.
- Light/dark is the family's `dh-theme.js` in both builds: two states with the system as default, shared across `*.dragonhound.dev` by a `dh-theme` cookie when you toggle it. The old three-state toggle and its `localStorage` key are gone.
- The point view frames the cloud on its 1st to 99th height percentile (noise classes left out), so a few far outliers no longer put the camera under the ground.
- `src/proxy.ts` is now `src/proxy.live.ts` and the docs image route `route.live.ts`: routes in the live build only.
- Re-synced to argus-survey `dev` at `8d966b6` (the 0.1.2 release merge): the wire pin, the demo record and the README's demo table. The wire schema and the demo numbers are unchanged (#21).
- The release workflow builds the arm64 image on a native arm64 runner instead of under QEMU: each architecture builds and pushes by digest on its own runner, with its own build cache, and a final job tags the merged multi-platform image `X.Y.Z`, `X.Y` and `latest` (an rc tag moves neither `X.Y` nor `latest`). Follows argus-studio#187, whose QEMU arm64 build crashed during `npm ci`.

### Fixed
- The hosted demo's "Open the recorded job" (and the guided demo's start) was a `<button>` inside a link, shown disabled at 45% opacity until the recording loaded, so a page caught early showed a washed-out button. It is a link styled as a button once the job is known, and a disabled button only before.
- On a phone the 3D view's "Colour by" panel covered the Map / 3D points / Split toggle. It now starts collapsed, and in any pane narrower than 42rem it and the map's Layers panel sit below the toggle. Split stacks map over points below `lg`. `demo-e2e` fails if either panel covers the toggle and screenshots Split.
- Map rasters (hillshade, DTM, DSM, CHM, density, change) drew black: MapLibre 5.24 renders an image source resampled `nearest` as black. They resample `linear` now.

### Security
- `ARGUS_SURVEY_BASEMAP_ATTRIBUTION` is reduced to text and `http(s)` links before it reaches the map, with a warning when markup is dropped. maplibre-gl ≤ 6.4.0's attribution sanitizer can be bypassed (GHSA-jrc7-96c5-q579), and the fix has no 5.x release. The value comes from the deployment and the CSP already blocks the payload, so this is defence in depth until the maplibre upgrade.

## [0.1.1] - 2026-11-14

### Added
- A release workflow (`.github/workflows/release.yml`): a `v*` tag that matches `package.json` and has a CHANGELOG section publishes `ghcr.io/smk762/argus-sightline` (linux/amd64 and linux/arm64, tagged `X.Y.Z`, `X.Y` and `latest`), then creates the GitHub Release from that section with the `docker pull` line.
- The image has a health check: the home page, which renders without the API.

### Changed
- Follows argus-survey v0.1.0: the wire schema, generated types, sync pins and the demo record are re-synced to the released survey (#16).

## [0.1.0] - 2026-11-13

### Added
- First version: a workspace for argus-survey's whole workflow (ingest → QA → ground → surfaces → contours → volume, cut/fill, change, accuracy, profile → report) over its SSE API, with a live console and the job's provenance log.
- Guided demo on `argus-survey synth --kit` data (`make demo-data`), showing measured against analytic truth for the stockpile, cut/fill and change.
- MapLibre map of the API's derived views with opacity, legends and drawing tools (volume polygons, profile lines); COPC point view (laz-perf + three.js).
- Datum chips (horizontal, vertical, geoid, epoch); an assumed or missing vertical datum shows in red.
- Types generated from argus-survey's `schema/survey-wire.schema.json` (pinned by sha256).
- Runtime config per request (`ARGUS_SURVEY_URL`, `ARGUS_SURVEY_BASEMAP`, `ARGUS_SURVEY_BASEMAP_ATTRIBUTION`, `ARGUS_STUDIO_URL`); light/dark themes; phone layout.
- A strict, nonce-based Content-Security-Policy per request (`src/proxy.ts`; `ARGUS_SIGHTLINE_CSP=report-only|off`).
- Drawing on the map from the keyboard: Enter adds a vertex under a centre crosshair, Shift+Enter finishes, and the HUD has Add centre and Finish buttons.
- Form hints and errors are linked to their inputs (`aria-describedby`, `aria-invalid`) and announced through one polite live region, as is a step's refusal.
- `prefers-reduced-motion` is respected: the decorative pulse stops, and progress indicators slow down rather than stop.
- The point view recolours in chunks that yield to input, and stops rendering while it is hidden.
- "Made with" on every completed step: the argus-survey version, the step's recorded parameters, the tools it ran and the files it wrote, all read from `job.json` (#7).
- Links from each step panel, the datum chips and the demo's truth rows to argus-survey's docs at the synced commit. An assumed or missing vertical datum links to survey's table of refusals (#7).
- A sync record for argus-survey (`schema/pins.json`: `dev` commit, version, docs hashes). `make demo-record` re-measures the README's demo table against a live API, `make check` fails when the pin, the recorded numbers and the README disagree, and a daily workflow opens an issue when survey's `dev` moves past the pin (#7).
- Compose stack with argus-survey (`make up` builds `../argus-survey`); CI runs the wire check, lint, typecheck, tests, build and the image build.

### Fixed
- The compose stack showed OpenStreetMap tiles without OSM's attribution, because compose names OSM's tile URL explicitly (#9).

[Unreleased]: https://github.com/smk762/argus-sightline/compare/v0.2.0...dev
[0.2.0]: https://github.com/smk762/argus-sightline/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/smk762/argus-sightline/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/smk762/argus-sightline/releases/tag/v0.1.0
