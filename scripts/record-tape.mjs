#!/usr/bin/env node
// Records the hosted demo's data tape: one real argus-survey job on public LiDAR, run through a live
// API with the same requests the panels send, then every response the UI reads saved as a static file.
// The static build (`make pages`) replays it with no API at all (src/lib/staticApi.ts).
//
//   SURVEY_COMMIT=<sha> node scripts/record-tape.mjs     (or: make tape)
//
// Needs an API with SURVEY_ALLOW_PROCESS=1 at ARGUS_SURVEY_URL (default http://localhost:8107), built from
// survey at SURVEY_COMMIT (the pin in schema/pins.json), with the sample under its data root as
// usgs-3dep/{site.laz,pile.geojson,xs1.geojson} (`make tape-data` fetches the cloud and copies the two
// vectors from scripts/tape-data/; see public/data-tape/PROVENANCE.md). The job must not exist yet. Writes public/data-tape/, replacing it. Runs on CPU in well under a minute.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
// Node calls the API itself, so this is the suite-wide server URL, not the browser's ARGUS_SURVEY_UI_URL.
const api = (process.env.ARGUS_SURVEY_URL ?? "http://localhost:8107").replace(/\/+$/, "");
const commit = process.env.SURVEY_COMMIT ?? "";
const out = join(root, "public", "data-tape");
const JOB = "usgs-3dep";
const DIR = "usgs-3dep/";
/**
 * Products the page downloads ship whole; other products ship up to this size, so the tape stays small
 * (Pages also caps a file at 25 MiB). The rest are listed with their SHA256 but not downloadable here.
 */
const MAX_PRODUCT = 640 * 1024;
const ALWAYS = new Set(["classified", "report", "profile", "profile_svg"]); // the 3D view streams the classified COPC
/** The map's layers (src/components/workspace/MapView.tsx LAYERS). */
const VIEWS = ["hillshade", "dtm", "dsm", "chm", "density", "dod_lod", "boundary", "gaps", "contours_geojson"];
const RASTER_VIEWS = new Set(["hillshade", "dtm", "dsm", "chm", "density", "dod_lod"]);

const pins = JSON.parse(await readFile(join(root, "schema", "pins.json"), "utf8"));
if (commit !== pins.survey.tag) throw new Error(`SURVEY_COMMIT must be the pinned survey commit ${pins.survey.tag}`);

async function get(path) {
  const resp = await fetch(api + path);
  if (!resp.ok) throw new Error(`GET ${path}: HTTP ${resp.status} ${await resp.text()}`);
  return resp;
}
const getJson = async (path) => (await get(path)).json();

async function save(rel, body, pretty = true) {
  const file = join(out, rel);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, typeof body === "string" || body instanceof Uint8Array ? body : `${JSON.stringify(body, null, pretty ? 1 : undefined)}\n`);
}

/** POST a step and keep every SSE event with its offset in ms from the request. */
async function step(name, body) {
  process.stdout.write(`${JOB} ${name}… `);
  const t0 = performance.now();
  const resp = await fetch(`${api}/jobs/${JOB}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${name}: HTTP ${resp.status} ${await resp.text()}`);
  const events = [];
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of resp.body) {
    buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n?/g, "\n");
    let end;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = /^event: ?(.*)$/m.exec(block)?.[1];
      const data = [...block.matchAll(/^data: ?(.*)$/gm)].map((m) => m[1]).join("\n");
      if (!event || !data) continue;
      events.push({ t: Math.round(performance.now() - t0), event, data: JSON.parse(data) });
      if (event === "error") throw new Error(`${name}: ${data}`);
    }
  }
  if (!events.some((e) => e.event === "done")) throw new Error(`${name}: the stream ended without a result`);
  console.log(`done in ${(events.at(-1).t / 1000).toFixed(1)} s`);
  return { job: JOB, step: name, body, events };
}

const health = await getJson("/health");
if (health.read_only) throw new Error("the API is read-only: start it with SURVEY_ALLOW_PROCESS=1");
if (health.version !== pins.survey.version) throw new Error(`the API is survey ${health.version}, the pin is ${pins.survey.version}`);
const inputs = await getJson("/inputs");
for (const f of ["site.laz", "pile.geojson", "xs1.geojson"]) {
  if (!inputs.points.concat(inputs.vectors).includes(DIR + f)) throw new Error(`no ${DIR}${f} under the data root: run \`make tape-data\``);
}
// The committed copies of what `make tape-data` put under the data root.
const vector = async (name) => JSON.parse(await readFile(join(root, "scripts", "tape-data", name), "utf8")).features[0].geometry;
const pile = await vector("pile.geojson");
const xs1 = await vector("xs1.geojson");

// The README's walkthrough settings: the EPT declares no vertical CRS (NAVD88 by the project's metadata), and
// Web Mercator is refused as a working CRS, so the job works in NAD83(2011) / UTM 11N + NAVD88.
const runs = [
  await step("run", {
    inputs: [`${DIR}site.laz`],
    assume_vertical: "EPSG:5703",
    t_srs: "EPSG:6340+5703",
    res: 0.5,
    interval: 2,
    force: true,
  }),
  await step("volume", { polygon: `${DIR}pile.geojson`, base: "plane", surface: "dsm", allow_voids: false }),
  // As the Profile panel sends a line drawn on the map.
  await step("profile", { line: xs1, step: 0.5 }),
  await step("report", {}),
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// The server's own posture is recorded as it was; the static data layer answers read_only for the replay.
await save("health.json", health);
await save("doctor.json", await getJson("/doctor"));
// Only the tape's own inputs: anything else under the data root (the demo kit, a client's files) stays out of a
// public tape, and the replay must not offer the kit's tips against a job that is not the kit.
await save(
  "inputs.json",
  Object.fromEntries(Object.entries(inputs).map(([k, files]) => [k, files.filter((f) => f.startsWith(DIR))])),
);
// Only the tape's own job, as for inputs.json: other jobs on the server (the demo kit's) have no pages in the
// export and no place in a public tape.
const { jobs } = await getJson("/jobs");
await save("jobs.json", { jobs: jobs.filter((j) => j.job_id === JOB) });

const sidecar = await getJson(`/jobs/${JOB}`);
await save(`jobs/${JOB}/job.json`, sidecar);

const views = [];
for (const kind of VIEWS) {
  if (!(kind in (sidecar.products ?? {}))) continue;
  const view = await getJson(`/jobs/${JOB}/web/${kind}`);
  if (RASTER_VIEWS.has(kind)) {
    const png = new Uint8Array(await (await get(view.url)).arrayBuffer());
    await save(`jobs/${JOB}/web/${view.png}`, png);
    view.url = `jobs/${JOB}/web/${view.png}`; // relative to the tape
  }
  await save(`jobs/${JOB}/web/${kind}.json`, view, RASTER_VIEWS.has(kind)); // GeoJSON compact
  views.push(kind);
}

const products = {};
const skipped = {};
for (const [kind, p] of Object.entries(sidecar.products ?? {})) {
  if (p.size > MAX_PRODUCT && !ALWAYS.has(kind)) {
    skipped[kind] = p.size;
    continue;
  }
  const name = p.path.split("/").pop();
  const body = new Uint8Array(await (await get(`/jobs/${JOB}/${kind}`)).arrayBuffer());
  await save(`jobs/${JOB}/products/${name}`, body);
  products[kind] = `jobs/${JOB}/products/${name}`;
}

await save("tape.json", {
  tape: 1,
  recorded_at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  survey: { commit, version: health.version },
  job: JOB,
  runs,
  views: { [JOB]: views },
  products: { [JOB]: products },
  skipped: { [JOB]: skipped },
  // What the measure steps measured, for the map: the volume polygon (open ring) and the profile line, in lon/lat.
  overlays: { [JOB]: { volume: { kind: "polygon", coords: pile.coordinates[0].slice(0, -1) }, profile: { kind: "line", coords: xs1.coordinates } } },
  provenance: "PROVENANCE.md",
});

const provenance = await readFile(join(root, "scripts", "tape-provenance.md"), "utf8");
await save("PROVENANCE.md", provenance.replace("{{recorded}}", `argus-survey ${health.version} @ \`${commit.slice(0, 7)}\``));
console.log(`Wrote ${out} (${Object.keys(products).length} products, ${views.length} map views).`);
