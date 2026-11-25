# argus-sightline

**Sightline** is the web workspace for [argus-survey](https://github.com/smk762/argus-survey): point clouds to survey deliverables, with every datum on screen and every number next to its uncertainty.

It is a thin client. All processing, datum handling and provenance live in the argus-survey API (:8107). The UI names inputs that are already under the server's data root, runs steps and streams their output. It reads everything it shows from the job's `job.json` and the API's derived map views.

## What it does

- **Guided demo.** A synthetic site near Perth (MGA2020 zone 50 + AHD) with analytically known answers. Every measure step shows *measured against truth*:

  <!-- demo-record:start -->
  | Demo check | Truth | Measured |
  |---|---|---|
  | Stockpile volume, from the kit polygon (DSM) | 268.1 m³ | 268.2 m³ |
  | Stockpile volume, epoch 2, from the kit polygon (DSM) | 335.1 m³ | 335.3 m³ |
  | Pad cut − fill against `design.tif` | 90.0 m³ | 90.0 m³ |
  | Change between epochs, inside the stockpile (LoD 0) | 67.0 m³ | 67.3 m³ |

  Measured by `make demo-record` against argus-survey 0.1.dev89+g452e5021d @ `452e502`.
  <!-- demo-record:end -->
- **The whole workflow.** Ingest (working CRS, assumed vertical datum, pinned transformation, crop), QA, ground (SMRF/CSF), surfaces (DTM/DSM/CHM, void fill), contours, stockpile volume (fitted-plane / lowest-edge / surface base), cut/fill against a design, change between epochs (fixed or accuracy-derived LoD), ASPRS ed. 2 accuracy (NVA/VVA, residual histogram), profiles, and the report. "Run core pipeline" goes from points to a report in one step.
- **Map.** Hillshade, DTM/DSM/CHM, density, change, contours, coverage and gaps over an optional basemap, with opacity, legends, and drawing tools for volume polygons and profile lines.
- **3D points.** The job's COPC streamed over HTTP range requests (laz-perf WASM, three.js), coloured by class, height or intensity, with a point budget.
- **Provenance.** A live console of every step and tool call as it runs, and the job's full command log (argv and PDAL pipelines). The products list shows each product's SHA256.
- **Docs.** argus-survey's docs at the synced commit, at `/docs/survey`. Each step panel, datum chip, demo truth row, volume base and accuracy class links to its section.
- **Rule 1, always visible.** Horizontal CRS, vertical datum, geoid and epoch chips in the header. An assumed or missing vertical datum is shown in red.

## Hosted demo

[sightline.dragonhound.dev](https://sightline.dragonhound.dev) replays one recorded argus-survey job on public USGS 3DEP lidar (an aggregate yard in Los Angeles County, California; public domain): ingest with an assumed vertical datum, QA, ground, surfaces, contours, a stockpile volume, a profile and the report, with the map, the 3D points and the console. It is a static site with no API; cut/fill, change and accuracy need inputs the public tile doesn't have. Data, licence and how it was recorded: [`public/data-tape/PROVENANCE.md`](public/data-tape/PROVENANCE.md).

```bash
make tape-data     # fetch the public tile into data/in/usgs-3dep
make up            # argus-survey at the pinned commit, processing on
make tape          # record public/data-tape/
make pages         # static export to out/, hash CSP on every page, then the static check
```

`.github/workflows/pages.yml` deploys it to Cloudflare Pages from every `dev` commit that passes CI.

## Run it

What this UI needs live, what its mock or recording stands in for, and the no-GPU command are in [What to run for which UI](https://docs.dragonhound.dev/setup/which-services/#sightline). Each external service it depends on has a setup page under the suite's [Setup and services](https://docs.dragonhound.dev/setup/).

You need Docker and a checkout of argus-survey next to this one (`../argus-survey`). It isn't on GHCR yet, so `make up` builds it.

```bash
cp .env.example .env     # set UID/GID if not 1000
make demo-data           # writes data/in/kit/ (two epochs, checks, polygons, design surface)
make up                  # http://localhost:3107   (API on :8107)
```

Open the UI and press **Start the guided demo**. Put your own `.las`/`.laz`, polygons, design rasters and check-point CSVs under `data/in/` (mounted read-only); jobs are written to `data/jobs/`.

The survey container carries the suite's discovery labels (`argus.peer: survey`, `argus.service`, `argus.health`, `argus.port`), which argus-iris's agents read to list it in the suite directory. Nothing else reads them.

| Variable | Default | |
|---|---|---|
| `ARGUS_SURVEY_BROWSER_URL` | `http://localhost:8107` | The API as the *browser* sees it. Empty means same origin; a path prefix works behind a proxy. Called `ARGUS_SURVEY_URL` up to 0.2.0; see below. |
| `SURVEY_ALLOW_PROCESS` | `1` (compose) | Set on the API. `0` makes it read-only: browse jobs, maps, points and reports only. `1` is this compose stack's default; an argus-survey API started on its own is read-only until it is set to `1`. |
| `SURVEY_CORS_ORIGINS` | `http://localhost:3107` | The UI's origin. Widen it for a LAN or proxy origin. |
| `ARGUS_SURVEY_BASEMAP` | OpenStreetMap tiles | An XYZ template, or `none` for an offline blank canvas. |
| `ARGUS_SURVEY_BASEMAP_ATTRIBUTION` | OSM's, for OSM tiles | Attribution HTML shown on the map. Set it for a custom basemap; otherwise that basemap shows none. |
| `ARGUS_STUDIO_URL` | unset | Adds a link back to argus-studio. |
| `ARGUS_SIGHTLINE_CSP` | `enforce` | The nonce-based Content-Security-Policy. `report-only` sends it without enforcing it; `off` drops it. |

The config is read per request, not baked in at build time, so one image deploys to any origin.

`ARGUS_SURVEY_URL` is the suite-wide name for the address *servers* use to reach argus-survey (argus-cortex's `peers`, for example `http://survey:8107` in the suite file), which a browser usually can't reach. The UI doesn't give it to the browser. If you set it for this UI (0.2.0 or earlier), rename it to `ARGUS_SURVEY_BROWSER_URL`. A value that is a path (`/api/survey`) is still read under the old name, with a deprecation warning in the UI's log; an absolute URL under the old name is ignored, with a warning. The recording scripts (`make demo-record`, `make tape`) call the API from Node, so they keep `ARGUS_SURVEY_URL`.

### Published image

Each `v*` release publishes `ghcr.io/smk762/argus-sightline` for linux/amd64 and linux/arm64, tagged `X.Y.Z`, `X.Y` and `latest`. It serves on port 3000 as a non-root user, has a health check on `/`, and takes the variables above at run time:

```bash
docker pull ghcr.io/smk762/argus-sightline:latest
docker run -d -p 127.0.0.1:3107:3000 \
  -e ARGUS_SURVEY_BROWSER_URL=http://localhost:8107 \
  ghcr.io/smk762/argus-sightline:latest
```

The browser calls the API directly, so start argus-survey with `--cors` and this UI's origin in `SURVEY_CORS_ORIGINS`. argus-studio's `survey` profile runs this image next to argus-survey.

## Develop

Node isn't required on the host; the Makefile runs npm in `node:22.23.4-alpine`.

```bash
make install       # npm ci (+ copies laz-perf.wasm into public/)
make check         # wire types, eslint, tsc, vitest
make build         # next build
make wire-local    # after changing argus-survey's wire models: re-pin schema/ from ../argus-survey
make docs-pull     # import argus-survey's docs at the pinned commit into docs/survey/
make demo-record   # with `make up` running: re-measure the demo table above against the live API
```

The UI is synced to one argus-survey `dev` commit (`schema/pins.json`): the wire types, the demo numbers in this README (`schema/demo-record.json`) and the imported docs (`docs/survey/`, hashed in the pin) all describe it, and `make check` fails if they disagree. A daily workflow opens an issue when survey's `dev` moves past the pin; that issue lists the re-sync steps.

With Node on the host: `npm ci && npm run dev` (set `ARGUS_SURVEY_BROWSER_URL` in `.env.local`, and add `http://localhost:3000` to the API's `SURVEY_CORS_ORIGINS`).

## License

MIT
