/**
 * The hosted demo build (`SIGHTLINE_STATIC=1`, `make pages`): a pure static export that replays a
 * recorded argus-survey job (public/data-tape, written by scripts/record-tape.mjs) instead of calling
 * the API. Both reads are literal `process.env.NEXT_PUBLIC_*` expressions on purpose: Next inlines them
 * at build time, so the live build never carries the tape paths and the static build never calls an API.
 * next.config.ts maps SIGHTLINE_STATIC=1 onto NEXT_PUBLIC_SIGHTLINE_STATIC.
 */
export function staticDemo(): boolean {
  return process.env.NEXT_PUBLIC_SIGHTLINE_STATIC === "1";
}

/** Where the tape is served from: a path on this site (default `/data-tape`). */
export function tapeBase(): string {
  return (process.env.NEXT_PUBLIC_SIGHTLINE_TAPE_URL || "/data-tape").replace(/\/+$/, "");
}

export const REPO_URL = "https://github.com/smk762/argus-sightline";
export const SURVEY_REPO_URL = "https://github.com/smk762/argus-survey";

/**
 * Steps the recording has no inputs for, and why. Shown in place of the step's form, so the panel says what
 * it would need rather than offering controls that can't do anything here.
 */
export const NOT_RECORDED: Partial<Record<string, string>> = {
  cutfill: "Cut/fill compares the ground with a design surface, and this public tile comes with none.",
  change: "Change needs a second capture of the same site; the recording has one epoch.",
  accuracy: "An accuracy statement needs an independent check-point survey (at least 30 points), and this public tile has none.",
};

/** The tooltip on a control the demo leaves off. */
export const OFF_WRITE = "Not in this demo: running steps with your own settings needs the argus-survey API.";
