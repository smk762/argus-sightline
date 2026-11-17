/**
 * The hosted demo's data layer: the API calls surveyApi.ts makes, answered from the recorded tape
 * (lib/tape.ts) under NEXT_PUBLIC_SIGHTLINE_TAPE_URL. It reads only same-origin static files; nothing here
 * reaches an argus-survey server. Running a step replays the recording's events for it.
 */

import type { DoneEvent, HealthInfo, JobDigest, JobSidecar, RasterView } from "@/lib/generated/survey";
import { tapeBase } from "@/lib/demo";
import { eventsFor, parseTape, replaySchedule, tapePath, type Tape } from "@/lib/tape";
import type { SurveyEvent } from "@/lib/surveyApi";

let loading: Promise<Tape> | null = null;
/** Set once the tape has loaded, for the synchronous product URL lookups. */
let loaded: Tape | null = null;
const cache = new Map<string, Promise<unknown>>();

const fileUrl = (rel: string): string => `${tapeBase()}/${tapePath(rel)}`;

async function fetchJson<T>(rel: string): Promise<T> {
  let hit = cache.get(rel) as Promise<T> | undefined;
  if (!hit) {
    hit = (async () => {
      const resp = await fetch(fileUrl(rel));
      if (!resp.ok) throw new Error(`Could not read the data tape (${rel}: HTTP ${resp.status}).`);
      return (await resp.json()) as T;
    })();
    cache.set(rel, hit);
    hit.catch(() => cache.delete(rel));
  }
  return hit;
}

export function loadTape(): Promise<Tape> {
  if (!loading) {
    loading = fetchJson<unknown>("tape.json").then((raw) => (loaded = parseTape(raw)));
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

/** The tape as loaded, or null before the first read finishes. */
export const currentTape = (): Tape | null => loaded;

/** Recorded as the server answered; the replay itself never writes, so it reports read-only. */
export async function health(): Promise<HealthInfo> {
  await loadTape();
  return { ...(await fetchJson<HealthInfo>("health.json")), read_only: true };
}

export const doctor = <T>() => fetchJson<T>("doctor.json");
export const inputs = <T>() => fetchJson<T>("inputs.json");
export const jobs = async (): Promise<JobDigest[]> => (await fetchJson<{ jobs: JobDigest[] }>("jobs.json")).jobs;

/** The sidecar, or null for a job the recording does not have (the page then shows a new, empty job). */
export async function job(id: string): Promise<JobSidecar | null> {
  const tape = await loadTape();
  if (!tape.views[id]) return null;
  return fetchJson<JobSidecar>(`jobs/${encodeURIComponent(id)}/job.json`);
}

/** Whether `kind` of `job` is in the tape, so the page can offer it for download. */
export function hasProduct(id: string, kind: string): boolean {
  return !!loaded?.products[id]?.[kind];
}

/** A product's URL in the tape. Products left out of it point nowhere; the page shows those without a link. */
export function productUrl(id: string, kind: string): string {
  const file = loaded?.products[id]?.[kind];
  return file ? fileUrl(file) : "";
}

export async function rasterView(id: string, kind: string): Promise<RasterView & { imageUrl: string }> {
  const view = await fetchJson<RasterView>(`jobs/${encodeURIComponent(id)}/web/${encodeURIComponent(kind)}.json`);
  return { ...view, imageUrl: fileUrl(view.url) };
}

export const vectorView = (id: string, kind: string) =>
  fetchJson<GeoJSON.FeatureCollection>(`jobs/${encodeURIComponent(id)}/web/${encodeURIComponent(kind)}.json`);

/** Thrown when there is no recording to replay for a step. */
export class NotRecorded extends Error {
  constructor(step: string) {
    super(`The recording has no ${step} run to replay: running it needs the argus-survey API.`);
    this.name = "NotRecorded";
  }
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    if (ms <= 0) return resolve();
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

/** Replay the recorded events for `step` with their rhythm (gaps capped), then resolve with its `done`. */
export async function replayStep(id: string, step: string, onEvent: (e: SurveyEvent) => void, signal?: AbortSignal): Promise<DoneEvent> {
  const tape = await loadTape();
  signal?.throwIfAborted();
  const events = eventsFor(tape, id, step);
  if (!events) throw new NotRecorded(step);
  const at = replaySchedule(events);
  let clock = 0;
  let done: DoneEvent | null = null;
  for (const [i, e] of events.entries()) {
    await wait(at[i] - clock, signal);
    clock = at[i];
    signal?.throwIfAborted();
    onEvent({ event: e.event, data: e.data } as SurveyEvent);
    if (e.event === "done") done = e.data as DoneEvent;
  }
  if (!done) throw new NotRecorded(step);
  return done;
}
