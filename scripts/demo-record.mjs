#!/usr/bin/env node
// Records the guided demo's "measured against truth" numbers by running the kit
// through a live argus-survey API, the same requests the panels send. Writes
// schema/demo-record.json, the survey version into schema/pins.json, and the
// README's demo table, so the README, the guided demo and the sync record agree
// (`make check` fails when they don't: src/lib/sync.test.ts).
//
//   SURVEY_COMMIT=<sha> node scripts/demo-record.mjs     (or: make demo-record)
//
// Needs `make demo-data` and an API with SURVEY_ALLOW_PROCESS=1 at ARGUS_SURVEY_URL
// (default http://localhost:8107), built from survey at SURVEY_COMMIT. Writes the
// jobs record-e1 and record-e2, replacing them if they exist.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_END, DEMO_START, demoTable } from "./demo-table.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const api = (process.env.ARGUS_SURVEY_URL ?? "http://localhost:8107").replace(/\/+$/, "");
const commit = process.env.SURVEY_COMMIT ?? "";
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("SURVEY_COMMIT must be the full sha the API was built from");

// The kit's analytic truths; src/lib/sync.test.ts holds these to KIT_TRUTH (src/lib/demoKit.ts).
const cone = (r, h) => (Math.PI * r ** 2 * h) / 3;
const TRUTH = { e1: cone(8, 4), e2: cone(8, 5), change: cone(8, 1), pad: 0.25 * 18 * 20 };
const KIT_CRS = "EPSG:7850+5711";

async function getJson(path) {
  const resp = await fetch(api + path);
  if (!resp.ok) throw new Error(`GET ${path}: HTTP ${resp.status} ${await resp.text()}`);
  return resp.json();
}

/** POST a step and read its SSE stream to the end; resolves with the `done` payload. */
async function step(job, name, body) {
  process.stdout.write(`${job} ${name}… `);
  const resp = await fetch(`${api}/jobs/${job}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${name}: HTTP ${resp.status} ${await resp.text()}`);
  const text = (await resp.text()).replace(/\r\n?/g, "\n");
  for (const block of text.split("\n\n")) {
    const event = /^event: ?(.*)$/m.exec(block)?.[1];
    const data = [...block.matchAll(/^data: ?(.*)$/gm)].map((m) => m[1]).join("\n");
    if (event === "error") throw new Error(`${name}: ${data}`);
    if (event === "done") {
      console.log("done");
      return JSON.parse(data);
    }
  }
  throw new Error(`${name}: the stream ended without a result`);
}

const health = await getJson("/health");
if (health.read_only) throw new Error("the API is read-only: start it with SURVEY_ALLOW_PROCESS=1");
const inputs = await getJson("/inputs");
const e1 = inputs.points.find((p) => p.endsWith("site-e1.laz"));
if (!e1) throw new Error("no demo kit under the data root: run `make demo-data`");
const dir = e1.slice(0, -"site-e1.laz".length);

const pipeline = (file) => ({ inputs: [dir + file], t_srs: KIT_CRS, force: true, res: 0.5, interval: 0.5 });
const stockpile = { polygon: `${dir}stockpile.geojson`, base: "plane", surface: "dsm" };

await step("record-e1", "run", pipeline("site-e1.laz"));
await step("record-e1", "volume", stockpile);
await step("record-e1", "cutfill", { design: `${dir}design.tif`, polygon: `${dir}pad.geojson` });
await step("record-e2", "run", pipeline("site-e2.laz"));
await step("record-e2", "volume", stockpile);
await step("record-e2", "change", { against: "record-e1", surface: "dsm", lod: 0, polygon: `${dir}stockpile.geojson` });

const j1 = await getJson("/jobs/record-e1");
const j2 = await getJson("/jobs/record-e2");
const zone = (job, kind) => job.volumes.filter((v) => v.kind === kind).at(-1).zones[0];
const pad = zone(j1, "cutfill");
const round1 = (n) => Math.round(n * 10) / 10;

const record = {
  survey: { commit, version: j1.package_version },
  api_version: health.version,
  recorded_at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  checks: [
    ["stockpile-e1", "Stockpile volume, from the kit polygon (DSM)", TRUTH.e1, zone(j1, "stockpile").above_m3],
    ["stockpile-e2", "Stockpile volume, epoch 2, from the kit polygon (DSM)", TRUTH.e2, zone(j2, "stockpile").above_m3],
    ["pad-net-cut", "Pad cut − fill against `design.tif`", TRUTH.pad, pad.below_m3 - pad.above_m3],
    ["change-gain", "Change between epochs, inside the stockpile (LoD 0)", TRUTH.change, j2.change.gain_m3],
  ].map(([id, label, truth, measured]) => ({ id, label, unit: "m³", truth: round1(truth), measured: round1(measured) })),
};
if (j2.package_version !== record.survey.version) throw new Error("the two epochs were processed by different survey versions");

await writeFile(join(root, "schema", "demo-record.json"), `${JSON.stringify(record, null, 2)}\n`);

const pinsPath = join(root, "schema", "pins.json");
const pins = JSON.parse(await readFile(pinsPath, "utf8"));
pins.survey.version = record.survey.version;
await writeFile(pinsPath, `${JSON.stringify(pins, null, 2)}\n`);

const readmePath = join(root, "README.md");
const readme = await readFile(readmePath, "utf8");
const [before, rest] = readme.split(DEMO_START);
if (rest === undefined || !rest.includes(DEMO_END)) throw new Error(`README.md lacks the ${DEMO_START} … ${DEMO_END} markers`);
await writeFile(readmePath, before + demoTable(record) + rest.slice(rest.indexOf(DEMO_END) + DEMO_END.length));

console.log(`Recorded against argus-survey ${record.survey.version} @ ${commit.slice(0, 7)}.`);

