/**
 * Where the UI sends a reader for argus-survey's own docs, at the commit the UI
 * is synced to (schema/pins.json). One table, so that when the docs are imported
 * into this UI (argus-sightline#7), only `docsUrl` changes, not every caller.
 *
 * Until then every link goes to survey's GitHub source at the pinned commit, so
 * the text a reader sees is the text this UI was built and recorded against.
 */

import pins from "../../schema/pins.json";
import type { StepDef } from "@/lib/workflow";

export interface SyncRecord {
  repo: string;
  /** survey's `dev` commit the wire types, demo numbers and docs links are synced to. */
  commit: string;
  /** The package version at that commit, as the demo recording's `job.json` reported it. */
  version: string;
}

export const SURVEY: SyncRecord = {
  repo: pins.survey.repo,
  commit: pins.survey.tag,
  version: pins.survey.version,
};

export const shortSha = (sha: string): string => sha.slice(0, 7);

export type DocsTopic = StepDef["id"] | "datum" | "datum-fault" | "truth";

/** `[file, heading anchor]` in argus-survey at the pinned commit. */
const SECTIONS: Record<DocsTopic, readonly [string, string]> = {
  datum: ["README.md", "wa-datums-in-one-table"],
  "datum-fault": ["docs/runbook.md", "reading-refusals"],
  truth: ["docs/data-sources.md", "synthetic-data"],
  ingest: ["README.md", "commands"],
  qa: ["README.md", "commands"],
  ground: ["docs/runbook.md", "stockpiles"],
  surfaces: ["README.md", "how-the-numbers-are-made"],
  contours: ["README.md", "commands"],
  volume: ["docs/runbook.md", "stockpiles"],
  cutfill: ["README.md", "how-the-numbers-are-made"],
  change: ["README.md", "how-the-numbers-are-made"],
  accuracy: ["README.md", "how-the-numbers-are-made"],
  profile: ["README.md", "commands"],
  report: ["README.md", "commands"],
};

export function docsUrl(topic: DocsTopic, sync: SyncRecord = SURVEY): string {
  const [file, anchor] = SECTIONS[topic];
  return `https://github.com/${sync.repo}/blob/${sync.commit}/${file}#${anchor}`;
}

export const sourceUrl = (sync: SyncRecord = SURVEY): string => `https://github.com/${sync.repo}/tree/${sync.commit}`;
