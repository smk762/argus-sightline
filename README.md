# argus-sightline

**Sightline** is the web workspace for [argus-survey](https://github.com/smk762/argus-survey): point clouds to survey deliverables, with every datum on screen and every number next to its uncertainty.

It is a thin client. All processing, datum handling and provenance live in the argus-survey API (:8107). The UI names inputs that are already under the server's data root, runs steps and streams their output. It reads everything it shows from the job's `job.json` and the API's derived map views.

## What it does

- **Guided demo.** A synthetic site near Perth (MGA2020 zone 50 + AHD) with analytically known answers. Every measure step shows *measured against truth*:

  | Demo check | Truth | Measured |
  |---|---|---|
  | Stockpile volume, from the kit polygon (DSM) | 268.1 m³ | 268.2 m³ |
  | Stockpile volume, epoch 2, polygon drawn in the UI | 335.1 m³ | 334.7 m³ |
  | Pad cut − fill against `design.tif` | 90.0 m³ | 90.0 m³ |
  | Change between epochs, inside the stockpile (LoD 0) | 67.0 m³ | 67.3 m³ |

  Measured values come from a run in headless Chrome against `make up`.
- **The whole workflow.** Ingest (working CRS, assumed vertical datum, pinned transformation, crop), QA, ground (SMRF/CSF), surfaces (DTM/DSM/CHM, void fill), contours, stockpile volume (fitted-plane / lowest-edge / surface base), cut/fill against a design, change between epochs (fixed or accuracy-derived LoD), ASPRS ed. 2 accuracy (NVA/VVA, residual histogram), profiles, and the report. "Run core pipeline" goes from points to a report in one step.
- **Map.** Hillshade, DTM/DSM/CHM, density, change, contours, coverage and gaps over an optional basemap, with opacity, legends, and drawing tools for volume polygons and profile lines.
- **3D points.** The job's COPC streamed over HTTP range requests (laz-perf WASM, three.js), coloured by class, height or intensity, with a point budget.
- **Provenance.** A live console of every step and tool call as it runs, and the job's full command log (argv and PDAL pipelines). The products list shows each product's SHA256.
- **Rule 1, always visible.** Horizontal CRS, vertical datum, geoid and epoch chips in the header. An assumed or missing vertical datum is shown in red.

## Run it

You need Docker and a checkout of argus-survey next to this one (`../argus-survey`). It isn't on GHCR yet, so `make up` builds it.

```bash
cp .env.example .env     # set UID/GID if not 1000
make demo-data           # writes data/in/kit/ (two epochs, checks, polygons, design surface)
make up                  # http://localhost:3107   (API on :8107)
```

Open the UI and press **Start the guided demo**. Put your own `.las`/`.laz`, polygons, design rasters and check-point CSVs under `data/in/` (mounted read-only); jobs are written to `data/jobs/`.

| Variable | Default | |
|---|---|---|
| `ARGUS_SURVEY_URL` | `http://localhost:8107` | The API as the *browser* sees it. Empty means same origin; a path prefix works behind a proxy. |
| `SURVEY_ALLOW_PROCESS` | `1` | `0` makes the API read-only: browse jobs, maps, points and reports only. |
| `SURVEY_CORS_ORIGINS` | `http://localhost:3107` | The UI's origin. Widen it for a LAN or proxy origin. |
| `ARGUS_SURVEY_BASEMAP` | OpenStreetMap tiles | An XYZ template, or `none` for an offline blank canvas. |
| `ARGUS_STUDIO_URL` | unset | Adds a link back to argus-studio. |
| `ARGUS_SIGHTLINE_CSP` | `enforce` | The nonce-based Content-Security-Policy. `report-only` sends it without enforcing it; `off` drops it. |

The config is read per request, not baked in at build time, so one image deploys to any origin.

## Develop

Node isn't required on the host; the Makefile runs npm in `node:22.23.4-alpine`.

```bash
make install       # npm ci (+ copies laz-perf.wasm into public/)
make check         # wire types, eslint, tsc, vitest
make build         # next build
make wire-local    # after changing argus-survey's wire models: re-pin schema/ from ../argus-survey
```

With Node on the host: `npm ci && npm run dev` (set `ARGUS_SURVEY_URL` in `.env.local`, and add `http://localhost:3000` to the API's `SURVEY_CORS_ORIGINS`).

## License

MIT
