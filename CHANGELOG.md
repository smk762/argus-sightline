# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- First version: a workspace for argus-survey's whole workflow (ingest → QA → ground → surfaces → contours → volume, cut/fill, change, accuracy, profile → report) over its SSE API, with a live console and the job's provenance log.
- Guided demo on `argus-survey synth --kit` data (`make demo-data`), showing measured against analytic truth for the stockpile, cut/fill and change.
- MapLibre map of the API's derived views with opacity, legends and drawing tools (volume polygons, profile lines); COPC point view (laz-perf + three.js).
- Datum chips (horizontal, vertical, geoid, epoch); an assumed or missing vertical datum shows in red.
- Types generated from argus-survey's `schema/survey-wire.schema.json` (pinned by sha256).
- Runtime config per request (`ARGUS_SURVEY_URL`, `ARGUS_SURVEY_BASEMAP`, `ARGUS_STUDIO_URL`); light/dark themes; phone layout.
- Compose stack with argus-survey (`make up` builds `../argus-survey`); CI runs the wire check, lint, typecheck, tests, build and the image build.
