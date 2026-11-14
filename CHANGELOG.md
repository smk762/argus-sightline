# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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

[Unreleased]: https://github.com/smk762/argus-sightline/compare/v0.1.1...dev
[0.1.1]: https://github.com/smk762/argus-sightline/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/smk762/argus-sightline/releases/tag/v0.1.0
