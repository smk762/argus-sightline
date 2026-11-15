# Data tape: provenance and licence

What the hosted demo (sightline.dragonhound.dev) replays. Nothing here runs a model or a server: the files are
one real argus-survey job, recorded by `make tape` (scripts/record-tape.mjs) and served as static files.

## Source data

- **Dataset:** USGS 3D Elevation Program (3DEP) lidar point cloud, project `USGS_LPC_CA_LosAngeles_2016_LAS_2018`,
  read from the USGS Entwine Point Tiles on AWS Open Data
  (`https://s3-us-west-2.amazonaws.com/usgs-lidar-public/USGS_LPC_CA_LosAngeles_2016_LAS_2018/ept.json`).
- **Area:** a 360 × 360 m Web Mercator window (about 300 × 300 m on the ground) over an aggregate yard in the
  San Gabriel Valley, Los Angeles County, California, USA. EPSG:3857 bounds
  `([-13134780, -13134420], [4040300, 4040660])`. 450,545 points.
- **Licence:** public domain. USGS-produced data are not subject to copyright in the United States.
  Credit: "U.S. Geological Survey, 3D Elevation Program".
- **Fetched with:** PDAL in the argus-survey image,
  `pdal translate <ept.json> site.laz --readers.ept.bounds="<bounds above>"` (`make tape-data`).
- **Datums:** the EPT is reprojected to EPSG:3857 and declares no vertical CRS. The heights are the project's
  orthometric heights (NAVD88), so the job ingests with `--assume-vertical EPSG:5703`, which argus-survey
  records and flags in red, and works in NAD83(2011) / UTM zone 11N + NAVD88 (`EPSG:6340+5703`). That
  transformation goes through WGS 84 and is only good to about 2 m: the job warns it is not survey grade.

## Inputs written for the demo

- `pile.geojson`: a polygon drawn around two conical piles in the yard, for the stockpile volume.
- `xs1.geojson`: a line across the long curved pile, for the profile (sent as a drawn line).

Both are in `scripts/tape-data/` and carry no data beyond their coordinates.

## Recording

- Recorded with argus-survey 0.1.dev69+g8d966b6ec @ `8d966b6`, the commit this UI is synced to (`schema/pins.json`), on CPU.
- Steps: the core pipeline (`run`: ingest, QA, ground, surfaces at 0.5 m, contours at 2 m, report), then
  `volume` (fitted-plane base, DSM), `profile` (0.5 m step) and `report` again.
- Files: `tape.json` (the recording: each step's request and its server-sent events with their timing),
  the API's answers (`health.json`, `doctor.json`, `inputs.json`, `jobs.json`, `jobs/<id>/job.json`), the map
  views (`jobs/<id>/web/`) and the job's products (`jobs/<id>/products/`), byte for byte; their SHA256s are in
  `job.json`. To keep the tape small, products over 640 KB ship only when the page reads them (the classified
  COPC the 3D view streams, the report and the profile); `tape.json` lists the rest under `skipped`.
- To re-record: `make tape-data`, then `make up` with `SURVEY_SRC` at the pinned commit and `make tape`.

Not recorded: cut/fill (needs a design surface), change (needs a second epoch of the same site) and the
accuracy statement (needs an independent check-point survey). None exists for this public tile, so those
steps are shown as not in this demo.
