// The hosted demo build's guards: with NEXT_PUBLIC_SIGHTLINE_STATIC=1 every read comes from the tape
// (same-origin static files), nothing reaches an argus-survey API, and running a step replays the recording.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TAPE = new URL("../../public/data-tape/", import.meta.url);
const fetched: string[] = [];

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SIGHTLINE_STATIC", "1");
  vi.stubEnv("NEXT_PUBLIC_SIGHTLINE_TAPE_URL", "/data-tape");
  vi.stubGlobal("fetch", async (input: string) => {
    const url = String(input);
    fetched.push(url);
    if (!url.startsWith("/data-tape/")) return new Response("{}", { status: 599 });
    try {
      return new Response(readFileSync(new URL(url.slice("/data-tape/".length), TAPE)), { status: 200 });
    } catch {
      return new Response("not found", { status: 404 });
    }
  });
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("static demo api", () => {
  it("reads health, doctor, inputs, jobs, the job and its map views from the tape only", async () => {
    const api = await import("./surveyApi");
    const health = await api.getHealth();
    expect(health.read_only).toBe(true);
    expect((await api.getDoctor()).ok).toBe(true);
    expect((await api.getInputs()).points.length).toBeGreaterThan(0);
    const [job] = await api.listJobs();
    const sidecar = (await api.getJob(job.job_id))!;
    expect(sidecar.steps_done).toContain("volume");
    expect(await api.getJob("not-recorded")).toBeNull();
    const hillshade = await api.getRasterView(job.job_id, "hillshade");
    expect(hillshade.imageUrl).toMatch(/^\/data-tape\/jobs\/[^/]+\/web\/hillshade\.[0-9a-f]+\.v\d+\.png$/);
    expect((await api.getVectorView(job.job_id, "boundary")).type).toBe("FeatureCollection");
    expect(api.productUrl(job.job_id, "report")).toMatch(/^\/data-tape\/jobs\/[^/]+\/products\/report\.html$/);
    expect(api.hasProduct(job.job_id, "classified")).toBe(true);
    expect(api.hasProduct(job.job_id, "dtm")).toBe(false); // left out to keep the tape small
    expect(api.productUrl(job.job_id, "dtm")).toBe("");
    expect(fetched.every((url) => url.startsWith("/data-tape/"))).toBe(true);
  });

  it("replays a step's recorded events, whatever the request body says", async () => {
    vi.useFakeTimers();
    const api = await import("./surveyApi");
    const [job] = await api.listJobs();
    const seen: string[] = [];
    const done = api.runStep(job.job_id, "volume", { polygon: "anything" }, (e) => seen.push(e.event));
    await vi.runAllTimersAsync();
    expect((await done).step).toBe("volume");
    expect(seen.at(-1)).toBe("done");
    expect(seen).toContain("command");
    vi.useRealTimers();
  });

  it("refuses a step the recording has no run for, without a request past the tape", async () => {
    const api = await import("./surveyApi");
    const [job] = await api.listJobs();
    const before = fetched.length;
    await expect(api.runStep(job.job_id, "accuracy", {}, () => {})).rejects.toBeInstanceOf(api.Refused);
    expect(fetched.slice(before).every((url) => url.startsWith("/data-tape/"))).toBe(true);
  });

  it("has a fixed config with no API, Studio link or basemap", async () => {
    const { runtimeConfig } = await import("./runtimeConfig");
    expect(runtimeConfig()).toEqual({ surveyUrl: "", studioUrl: "", basemapUrl: "", basemapAttribution: "" });
  });
});
