// The hosted demo's tape only ever holds public data, never a client's survey. Every input the recording
// names (the API's /inputs listing, each step's request, the sidecar's inputs and command lines) must be a
// file of a dataset on the allowlist below, fetched from that dataset's public source or drawn in this repo.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTape } from "@/lib/tape";

const root = new URL("../../", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, root), "utf8");
const readJson = (rel: string) => JSON.parse(read(rel));

/**
 * Public datasets the tape may carry, by their directory under the survey data root. `fetched` names each
 * file taken from the dataset's public source (and the source it must come from); `drawn` names the
 * vectors written for the demo, which live in scripts/tape-data/. Adding a dataset here is a privacy
 * decision: it needs a public source, a licence that allows redistribution and a PROVENANCE.md entry.
 */
const PUBLIC_DATASETS: Record<string, { fetched: Record<string, RegExp>; drawn: string[]; licence: string }> = {
  "usgs-3dep": {
    // USGS 3DEP lidar on AWS Open Data (Entwine Point Tiles). Public domain.
    fetched: { "site.laz": /^https:\/\/s3-us-west-2\.amazonaws\.com\/usgs-lidar-public\/[A-Za-z0-9_]+\/ept\.json$/ },
    drawn: ["pile.geojson", "xs1.geojson"],
    licence: "public domain",
  },
};

const tape = parseTape(readJson("public/data-tape/tape.json"));
const job = readJson(`public/data-tape/jobs/${tape.job}/job.json`);
const makefile = read("Makefile");
const provenance = read(`public/data-tape/${tape.provenance ?? "PROVENANCE.md"}`);
const makeVar = (name: string) => new RegExp(`^${name} = (.+)$`, "m").exec(makefile)?.[1].trim() ?? "";

/** Whether `rel` (`<dataset>/<file>`) is a file of an allowlisted public dataset. */
function isPublic(rel: string): boolean {
  const [dir, file, ...rest] = rel.split("/");
  // Own keys only: `in` or plain indexing would let "usgs-3dep/constructor" through on Object.prototype.
  if (rest.length !== 0 || !Object.hasOwn(PUBLIC_DATASETS, dir)) return false;
  const ds = PUBLIC_DATASETS[dir];
  return Object.hasOwn(ds.fetched, file) || ds.drawn.includes(file);
}

/** Every `/data/in/…` path anywhere inside `value`'s strings, including those inside a command line. */
function dataInPaths(value: unknown): string[] {
  return strings(value).flatMap((s) => s.match(/\/data\/in\/[^\s"'=,;]+/g) ?? []);
}

/** Every string in `value`, however deep. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

/** Web Mercator (EPSG:3857) to lon/lat. */
const R = 6378137;
const toLonLat = ([x, y]: number[]) => [(x / R) * (180 / Math.PI), Math.atan(Math.sinh(y / R)) * (180 / Math.PI)];

describe("the provenance checks themselves", () => {
  it("allowlist only a dataset's own files, never an Object.prototype key", () => {
    expect(isPublic("usgs-3dep/site.laz")).toBe(true);
    for (const rel of ["usgs-3dep/constructor", "usgs-3dep/toString", "usgs-3dep/__proto__", "constructor/name", "__proto__/site.laz"]) {
      expect(isPublic(rel), rel).toBe(false);
    }
  });

  it("find input paths inside command lines and joined flags, not only whole strings", () => {
    const sidecar = { commands: ["pdal translate /data/in/client/a.laz out.laz", "--filename=/data/in/client/b.laz", "x '/data/in/c/d.tif'"] };
    expect(dataInPaths(sidecar)).toEqual(["/data/in/client/a.laz", "/data/in/client/b.laz", "/data/in/c/d.tif"]);
  });
});

describe("the tape's provenance", () => {
  it("names its provenance file, which credits each dataset's source and licence", () => {
    expect(tape.provenance).toBe("PROVENANCE.md");
    for (const ds of Object.values(PUBLIC_DATASETS)) expect(provenance.toLowerCase()).toContain(ds.licence);
    expect(provenance).toContain(makeVar("TAPE_EPT"));
  });

  it("records one job, named for an allowlisted public dataset", () => {
    expect(Object.keys(PUBLIC_DATASETS)).toContain(tape.job);
    expect(readdirSync(new URL("public/data-tape/jobs/", root))).toEqual([tape.job]);
    expect(readJson("public/data-tape/jobs.json").jobs.map((j: { job_id: string }) => j.job_id)).toEqual([tape.job]);
    expect(tape.runs.every((r) => r.job === tape.job)).toBe(true);
  });

  it("lists only public inputs under the data root", () => {
    const inputs = readJson("public/data-tape/inputs.json") as Record<string, string[]>;
    for (const rel of Object.values(inputs).flat()) expect(isPublic(rel), rel).toBe(true);
  });

  it("sent only public inputs in each step's request", () => {
    for (const run of tape.runs) {
      for (const s of strings(run.body).filter((s) => s.includes("/"))) expect(isPublic(s), `${run.step}: ${s}`).toBe(true);
    }
  });

  it("read only public inputs, as the sidecar and its command lines show", () => {
    const paths = [...job.inputs.map((i: { path: string }) => i.path), ...dataInPaths(job)];
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.startsWith("/data/in/"), path).toBe(true);
      expect(isPublic(path.slice("/data/in/".length)), path).toBe(true);
    }
  });

  it("fetched the point cloud from the dataset's public source, at the tile the Makefile names", () => {
    const ds = PUBLIC_DATASETS[tape.job];
    expect(makeVar("TAPE_EPT")).toMatch(ds.fetched["site.laz"]);
    const bounds = makeVar("TAPE_BOUNDS").match(/-?\d+(\.\d+)?/g)!.map(Number);
    const points = job.inputs.find((i: { role: string }) => i.role === "points").summary.bounds;
    expect([points.minx, points.maxx, points.miny, points.maxy]).toEqual(bounds);
  });

  it("drew its vectors in this repo, inside the public tile, carrying nothing but a name", () => {
    const [minx, maxx, miny, maxy] = makeVar("TAPE_BOUNDS").match(/-?\d+(\.\d+)?/g)!.map(Number);
    const [w, s] = toLonLat([minx, miny]);
    const [e, n] = toLonLat([maxx, maxy]);
    const inside = ([lon, lat]: number[]) => lon >= w && lon <= e && lat >= s && lat <= n;
    for (const file of PUBLIC_DATASETS[tape.job].drawn) {
      const fc = readJson(`scripts/tape-data/${file}`);
      for (const f of fc.features) {
        expect(Object.keys(f.properties ?? {}).every((k) => k === "name"), file).toBe(true);
        expect(f.geometry.coordinates.flat(2).length, file).toBeGreaterThan(0);
        const coords: number[][] = f.geometry.type === "Polygon" ? f.geometry.coordinates.flat() : f.geometry.coordinates;
        expect(coords.every(inside), file).toBe(true);
      }
    }
    const overlays = Object.values(tape.overlays?.[tape.job] ?? {});
    for (const overlay of overlays) expect(overlay!.coords.every(inside)).toBe(true);
  });
});
