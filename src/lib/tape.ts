/**
 * The recorded data tape (public/data-tape/tape.json, written by scripts/record-tape.mjs): pure parsing and
 * replay helpers, so the static data layer (staticApi.ts) stays a thin file reader and the rules are tested.
 */

import type { SurveyEvent } from "@/lib/surveyApi";

export interface TapeEvent {
  /** Milliseconds from the request to this event, as recorded. */
  t: number;
  event: SurveyEvent["event"];
  data: unknown;
}

export interface TapeRun {
  job: string;
  step: string;
  body: Record<string, unknown>;
  events: TapeEvent[];
}

export interface Tape {
  tape: 1;
  recorded_at: string;
  survey: { commit: string; version: string };
  job: string;
  runs: TapeRun[];
  views: Record<string, string[]>;
  /** Per job: product kind → file under the tape. A kind not listed was left out to keep the tape small. */
  products: Record<string, Record<string, string>>;
  skipped?: Record<string, Record<string, number>>;
  /** Per job and step: the polygon or line that step measured, in lon/lat, for the map. */
  overlays?: Record<string, Partial<Record<string, { kind: "polygon" | "line"; coords: [number, number][] }>>>;
  provenance?: string;
}

const EVENTS = new Set(["start", "step", "command", "warning", "done", "error"]);

export function parseTape(raw: unknown): Tape {
  const t = raw as Partial<Tape> | null;
  if (!t || t.tape !== 1) throw new Error("Not a Sightline data tape (tape.json version 1).");
  if (typeof t.job !== "string" || !Array.isArray(t.runs) || !t.products || !t.views || !t.survey) {
    throw new Error("The data tape is incomplete.");
  }
  for (const run of t.runs) {
    if (!Array.isArray(run.events) || run.events.some((e) => !EVENTS.has(e.event) || typeof e.t !== "number")) {
      throw new Error(`The data tape's ${run.step} run has an unknown event.`);
    }
  }
  return t as Tape;
}

/** The step the recording has a run for, directly or inside the core pipeline (`run`). */
export function recordedSteps(tape: Tape, job: string): Set<string> {
  const steps = new Set<string>();
  for (const run of tape.runs) {
    if (run.job !== job) continue;
    steps.add(run.step);
    for (const e of run.events) {
      if (e.event === "step") steps.add((e.data as { step: string }).step);
    }
  }
  return steps;
}

/**
 * The events to replay for `step`: its own last run, or its slice of the core pipeline's stream (from its
 * `step start` to its `step done`) closed with a `done` event, as if the step had been run on its own.
 */
export function eventsFor(tape: Tape, job: string, step: string): TapeEvent[] | null {
  const runs = tape.runs.filter((r) => r.job === job);
  const own = runs.filter((r) => r.step === step).at(-1);
  if (own) return own.events;
  for (const run of runs) {
    const isStep = (e: TapeEvent, state: string) =>
      e.event === "step" && (e.data as { step: string; state: string }).step === step && (e.data as { state: string }).state === state;
    const from = run.events.findIndex((e) => isStep(e, "start"));
    const to = run.events.findIndex((e) => isStep(e, "done"));
    if (from < 0 || to < from) continue;
    const slice = run.events.slice(from, to + 1);
    const t0 = slice[0].t;
    const done = run.events.find((e) => e.event === "done")?.data as { products?: string[]; warnings?: string[] } | undefined;
    const shifted = slice.map((e) => ({ ...e, t: e.t - t0 }));
    const end = shifted.at(-1)!.t;
    return [
      { t: 0, event: "start", data: { job, step } },
      ...shifted,
      { t: end, event: "done", data: { job, step, result: {}, products: done?.products ?? [], warnings: [] } },
    ];
  }
  return null;
}

/**
 * When to emit each event in a replay, in ms from its start: the recorded gaps, each capped at `maxGap`, so
 * a 30-second pipeline replays in a few seconds but keeps its rhythm.
 */
export function replaySchedule(events: readonly TapeEvent[], maxGap = 350): number[] {
  const at: number[] = [];
  let prev = 0;
  let clock = 0;
  for (const e of events) {
    clock += Math.min(Math.max(e.t - prev, 0), maxGap);
    prev = e.t;
    at.push(clock);
  }
  return at;
}

const ESCAPES = /^[a-z][a-z0-9+.-]*:|^\/\/|(^|\/)\.\.(\/|$)|\\|[\u0000-\u001f\u007f]/i;

/**
 * A path inside the tape, made safe to join under the tape's base (no scheme, no parent segments). Checked
 * as written and percent-decoded, since a browser's URL parser reads `%2e%2e` as `..`, `\` as `/` and drops
 * tabs and newlines; any of those is refused.
 */
export function tapePath(rel: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    throw new Error(`Not a tape path: ${rel}`);
  }
  if (ESCAPES.test(rel) || ESCAPES.test(decoded)) throw new Error(`Not a tape path: ${rel}`);
  return rel.replace(/^\/+/, "");
}
