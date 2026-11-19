/**
 * Where the UI sends a reader for argus-survey's own docs. The docs are imported
 * into docs/survey/ at the commit the UI is synced to (schema/pins.json,
 * `make docs-pull`) and rendered at /docs/survey, so the text a reader sees is
 * the text this UI was built and recorded against. One table, so callers never
 * build a docs URL themselves.
 *
 * survey's tests/test_docs.py lists every anchor in SECTIONS and fails if its
 * heading disappears. Linking a new anchor here means adding it there (a PR to
 * argus-survey).
 */

import pins from "../../schema/pins.json";
import type { StepDef } from "@/lib/workflow";

export interface SyncRecord {
  repo: string;
  /** survey's `dev` commit the wire types, demo numbers and docs are synced to. */
  commit: string;
  /** The package version at that commit, as the demo recording's `job.json` reported it. */
  version: string;
}

export const SURVEY: SyncRecord = {
  repo: pins.survey.repo,
  commit: pins.survey.tag,
  version: pins.survey.version,
};

export const PYPI_URL = "https://pypi.org/project/argus-survey/";

export const shortSha = (sha: string): string => sha.slice(0, 7);

/** The in-app route for the docs. */
export const DOCS_ROOT = "/docs/survey";

/**
 * Imported markdown files by survey path, in reading order, with their slug under DOCS_ROOT.
 * `label` names the page in the nav when its own title doesn't say what it is.
 */
export const DOC_PAGES: readonly { file: string; slug: string; label?: string }[] = [
  { file: "README.md", slug: "", label: "Overview" },
  { file: "docs/datums.md", slug: "datums" },
  { file: "docs/steps.md", slug: "steps" },
  { file: "docs/methods.md", slug: "methods" },
  { file: "docs/provenance.md", slug: "provenance" },
  { file: "docs/runbook.md", slug: "runbook" },
  { file: "docs/data-sources.md", slug: "data-sources" },
  { file: "docs/api.md", slug: "api" },
  { file: "docs/cli.md", slug: "cli", label: "CLI reference" },
  { file: "docs/atlas-showcase.md", slug: "atlas-showcase" },
];

const IMPORTED = new Set(Object.keys(pins.survey.docs as Record<string, string>));

export type DocsTopic =
  | StepDef["id"]
  | "datum"
  | "datum-fault"
  | "truth"
  | "accuracy-method"
  | "volume-bases"
  | "provenance"
  | "refusals";

/** `[file, heading anchor]` in argus-survey at the pinned commit. */
export const SECTIONS: Record<DocsTopic, readonly [string, string]> = {
  datum: ["docs/datums.md", "no-silent-datums-rule-1"],
  "datum-fault": ["docs/datums.md", "why-red"],
  truth: ["docs/data-sources.md", "demo-kit"],
  "accuracy-method": ["docs/methods.md", "vertical-accuracy-nva-and-vva"],
  "volume-bases": ["docs/methods.md", "volume-bases"],
  provenance: ["docs/provenance.md", "what-jobjson-records"],
  refusals: ["docs/runbook.md", "reading-refusals"],
  // docs/steps.md's headings are the step ids.
  ingest: ["docs/steps.md", "ingest"],
  qa: ["docs/steps.md", "qa"],
  ground: ["docs/steps.md", "ground"],
  surfaces: ["docs/steps.md", "surfaces"],
  contours: ["docs/steps.md", "contours"],
  volume: ["docs/steps.md", "volume"],
  cutfill: ["docs/steps.md", "cutfill"],
  change: ["docs/steps.md", "change"],
  accuracy: ["docs/steps.md", "accuracy"],
  profile: ["docs/steps.md", "profile"],
  report: ["docs/steps.md", "report"],
};

const pageFor = (file: string) => DOC_PAGES.find((p) => p.file === file);

/** The file's page under DOCS_ROOT, or GitHub at the pinned commit when the file is not imported. */
export function fileUrl(file: string, anchor = "", sync: SyncRecord = SURVEY): string {
  const hash = anchor ? `#${anchor}` : "";
  const page = IMPORTED.has(file) ? pageFor(file) : undefined;
  if (page) return `${DOCS_ROOT}${page.slug ? `/${page.slug}` : ""}${hash}`;
  return `https://github.com/${sync.repo}/blob/${sync.commit}/${file}${hash}`;
}

export function docsUrl(topic: DocsTopic): string {
  const [file, anchor] = SECTIONS[topic];
  return fileUrl(file, anchor);
}

export const sourceUrl = (sync: SyncRecord = SURVEY): string => `https://github.com/${sync.repo}/tree/${sync.commit}`;

/**
 * GitHub's heading anchor, as survey's tests/test_docs.py computes it: lower-case,
 * drop punctuation except `-` and `_`, spaces to hyphens. Repeats get `-1`, `-2`…
 * from the caller.
 */
export const githubAnchor = (heading: string): string =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\- ]/gu, "")
    .replace(/ /g, "-");

const SURVEY_BLOB = /^https:\/\/github\.com\/smk762\/argus-survey\/blob\/[^/]+\/([^#?]+)(#.*)?$/;
const SURVEY_RAW_IMG = /^https:\/\/raw\.githubusercontent\.com\/smk762\/argus-survey\/[^/]+\/(docs\/img\/[^#?]+)$/;

/** Join a relative link onto the directory of the file it appears in (survey paths, posix). */
function resolvePath(from: string, rel: string): string | null {
  // A leading `/` is the repo root, as GitHub renders it.
  const parts = rel.startsWith("/") ? [] : from.split("/").slice(0, -1);
  for (const seg of rel.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length === 0) return null;
      parts.pop();
    } else parts.push(seg);
  }
  return parts.join("/");
}

export interface ResolvedLink {
  href: string;
  /** Off this site (or onto GitHub): opens in a new tab. */
  external: boolean;
}

/**
 * Where a link in an imported doc should go. Links between imported files (relative,
 * or survey's own GitHub URLs on any branch) stay in the docs; links to survey's
 * other files go to GitHub at the pinned commit; anything but http(s), mailto and in-page anchors
 * is dropped (null).
 */
export function resolveDocLink(href: string, from: string, sync: SyncRecord = SURVEY): ResolvedLink | null {
  if (href.startsWith("#")) return { href, external: false };
  const local = (file: string, anchor: string): ResolvedLink => {
    const url = fileUrl(file, anchor, sync);
    return { href: url, external: !url.startsWith(DOCS_ROOT) };
  };
  // survey's own GitHub URLs, on whatever branch they name, go to the pinned commit.
  const blob = SURVEY_BLOB.exec(href);
  if (blob) return local(blob[1], (blob[2] ?? "").slice(1));
  if (/^(?:https?:|mailto:)/i.test(href)) return { href, external: true };
  if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("//")) return null;
  const cut = href.indexOf("#");
  const file = resolvePath(from, cut < 0 ? href : href.slice(0, cut));
  if (file === null) return null;
  return local(file, cut < 0 ? "" : href.slice(cut + 1));
}

/** An image an imported doc shows, served from this origin, or null when it was not imported. */
export function resolveDocImage(src: string, from: string): string | null {
  const raw = SURVEY_RAW_IMG.exec(src);
  const file = raw ? raw[1] : /^[a-z][a-z\d+.-]*:|^\/\//i.test(src) ? null : resolvePath(from, src);
  if (!file || !IMPORTED.has(file) || !file.startsWith("docs/img/")) return null;
  return `${DOCS_ROOT}/img/${file.slice("docs/img/".length)}`;
}
