/**
 * Thin client for the argus-survey API (:8107). Shapes come from the generated
 * wire types (schema/survey-wire.schema.json); the job sidecar `job.json` is the
 * contract. The UI never sends a filesystem path: inputs are names under the
 * server's SURVEY_DATA_DIR (as `/inputs` lists them) and products are addressed
 * by `(job_id, kind)`.
 *
 * Writes are gated here, not in components: `runStep` refuses before the wire
 * when the server's last `/health` says it is read-only (studio#75's rule).
 */

import type {
  CommandEvent,
  DoctorReport,
  DoneEvent,
  ErrorEvent,
  HealthInfo,
  JobDigest,
  JobSidecar,
  RasterView,
  StartEvent,
  StepEvent,
  WarningEvent,
} from "@/lib/generated/survey";
import { readSse } from "@/lib/sse";
import { surveyUrl } from "@/lib/runtimeConfig";

export type Inputs = { points: string[]; vectors: string[]; rasters: string[]; tables: string[] };

export type SurveyEvent =
  | { event: "start"; data: StartEvent }
  | { event: "step"; data: StepEvent }
  | { event: "command"; data: CommandEvent }
  | { event: "warning"; data: WarningEvent }
  | { event: "done"; data: DoneEvent }
  | { event: "error"; data: ErrorEvent };

export const STEP_IDS = [
  "ingest",
  "qa",
  "ground",
  "surfaces",
  "contours",
  "volume",
  "cutfill",
  "change",
  "accuracy",
  "profile",
  "report",
  "run",
] as const;
export type StepId = (typeof STEP_IDS)[number];

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** The server said no before anything ran: read-only posture, or a step already running (409). */
export class Refused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Refused";
  }
}

const JOB_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const isSafeJobId = (id: string): boolean => JOB_ID.test(id) && id.length <= 128;

const url = (path: string): string => `${surveyUrl()}${path}`;

async function detail(resp: Response): Promise<string> {
  try {
    const body = await resp.json();
    if (typeof body?.detail === "string") return body.detail;
    return JSON.stringify(body?.detail ?? body);
  } catch {
    return resp.statusText || `HTTP ${resp.status}`;
  }
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(url(path), { cache: "no-store", ...init });
  } catch (err) {
    throw new ApiError(`cannot reach argus-survey at ${surveyUrl() || "this origin"} (${String(err)})`, 0);
  }
  if (!resp.ok) throw new ApiError(await detail(resp), resp.status);
  return (await resp.json()) as T;
}

let lastHealth: HealthInfo | null = null;

export async function getHealth(): Promise<HealthInfo> {
  lastHealth = await getJson<HealthInfo>("/health");
  return lastHealth;
}

export const getDoctor = () => getJson<DoctorReport & { ok: boolean }>("/doctor");
export const getInputs = () => getJson<Inputs>("/inputs");
export const listJobs = async (): Promise<JobDigest[]> => (await getJson<{ jobs: JobDigest[] }>("/jobs")).jobs;

/** The sidecar, or `null` when the job does not exist yet (a new survey). */
export async function getJob(id: string): Promise<JobSidecar | null> {
  try {
    return await getJson<JobSidecar>(`/jobs/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export const productUrl = (job: string, kind: string): string =>
  url(`/jobs/${encodeURIComponent(job)}/${encodeURIComponent(kind)}`);

export async function getRasterView(job: string, kind: string): Promise<RasterView & { imageUrl: string }> {
  const view = await getJson<RasterView>(`/jobs/${encodeURIComponent(job)}/web/${encodeURIComponent(kind)}`);
  return { ...view, imageUrl: url(view.url) };
}

export const getVectorView = (job: string, kind: string) =>
  getJson<GeoJSON.FeatureCollection>(`/jobs/${encodeURIComponent(job)}/web/${encodeURIComponent(kind)}`);

/**
 * Run one step and stream its events to `onEvent`. Resolves with the `done`
 * payload; rejects with the `error` event's message (and stderr tail), a
 * `Refused` when the server is read-only or busy, or an `ApiError`.
 */
export async function runStep(
  job: string,
  step: StepId,
  body: object,
  onEvent: (e: SurveyEvent) => void,
  signal?: AbortSignal,
): Promise<DoneEvent> {
  if (!isSafeJobId(job)) throw new Refused(`"${job}" is not a valid job id (letters, digits, . _ -)`);
  const health = lastHealth ?? (await getHealth());
  if (health.read_only) {
    throw new Refused("This argus-survey server is read-only (start it with SURVEY_ALLOW_PROCESS=1 to run steps).");
  }
  let resp: Response;
  try {
    resp = await fetch(url(`/jobs/${encodeURIComponent(job)}/${step}`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw new ApiError(`cannot reach argus-survey (${String(err)})`, 0);
  }
  if (resp.status === 403 || resp.status === 409) throw new Refused(await detail(resp));
  if (!resp.ok) throw new ApiError(await detail(resp), resp.status);
  let done: DoneEvent | null = null;
  for await (const message of readSse(resp)) {
    const e = message as SurveyEvent;
    onEvent(e);
    if (e.event === "done") done = e.data;
    if (e.event === "error") throw new StepFailed(e.data);
  }
  if (!done) throw new ApiError("the stream ended without a result (server restarted?)", 0);
  return done;
}

export class StepFailed extends Error {
  readonly stderr: string | null;
  constructor(data: ErrorEvent) {
    super(data.message);
    this.name = "StepFailed";
    this.stderr = data.stderr ?? null;
  }
}
