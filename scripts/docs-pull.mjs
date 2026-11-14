#!/usr/bin/env node
// Imports argus-survey's docs into docs/survey/ at the commit schema/pins.json pins
// (survey.tag), and records a sha256 per file in survey.docs. src/lib/sync.test.ts
// fails `make check` when a committed file no longer matches its hash, and the docs
// page (/docs/survey) renders these files, never survey's live branch.
//
//   node scripts/docs-pull.mjs        (or: make docs-pull / npm run docs:pull)
//
// Run it after changing the pin, in the same PR as `wire:pull` and `make demo-record`.
// The opsec gate refuses the import if a file carries a private IP, a home path or an
// email address: the docs are served from this UI, so nothing personal may ride along.

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pinsPath = join(root, "schema", "pins.json");
const outDir = join(root, "docs", "survey");

// The importable set (argus-sightline#23). docs/cli.md is generated from survey's CLI
// and survey's tests fail when it is stale, so it is current at any commit.
const FILES = [
  "README.md",
  "docs/datums.md",
  "docs/steps.md",
  "docs/methods.md",
  "docs/provenance.md",
  "docs/api.md",
  "docs/cli.md",
  "docs/runbook.md",
  "docs/data-sources.md",
  "docs/atlas-showcase.md",
];

// Images the docs show, by survey path. They are served from this origin (the CSP allows
// no other image host), so any docs/img/* a file references is imported with it.
const IMAGE_REF = /docs\/img\/([\w.-]+\.(?:png|jpe?g|webp|gif))/g;

const OPSEC = [
  [/\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/, "a private IP address"],
  [/(?:^|[\s"'(`])(?:\/home\/[a-z_][\w-]*|\/Users\/\w+|[A-Z]:\\Users\\)/m, "a home directory path"],
  [/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}\b/i, "an email address"],
];

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function fetchFile(repo, commit, path) {
  const url = `https://raw.githubusercontent.com/${repo}/${commit}/${path}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

function opsec(path, text) {
  return OPSEC.flatMap(([re, what]) => {
    const m = re.exec(text);
    return m ? [`${path}: ${what} (${JSON.stringify(m[0].trim())})`] : [];
  });
}

async function main() {
  const pins = JSON.parse(await readFile(pinsPath, "utf8"));
  const { repo, tag } = pins.survey;
  if (!/^[0-9a-f]{40}$/.test(tag)) throw new Error(`survey.tag must be a full commit sha, not ${JSON.stringify(tag)}`);

  const files = new Map();
  for (const path of FILES) files.set(path, await fetchFile(repo, tag, path));
  const images = new Set();
  for (const buf of files.values()) for (const m of buf.toString("utf8").matchAll(IMAGE_REF)) images.add(`docs/img/${m[1]}`);
  for (const path of [...images].sort()) files.set(path, await fetchFile(repo, tag, path));

  const problems = [...files].filter(([p]) => p.endsWith(".md")).flatMap(([p, buf]) => opsec(p, buf.toString("utf8")));
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    throw new Error("opsec gate: fix these in argus-survey before importing its docs");
  }

  await rm(outDir, { recursive: true, force: true });
  const docs = {};
  for (const [path, buf] of files) {
    await mkdir(dirname(join(outDir, path)), { recursive: true });
    await writeFile(join(outDir, path), buf);
    docs[path] = sha256(buf);
  }
  pins.survey.docs = docs;
  await writeFile(pinsPath, `${JSON.stringify(pins, null, 2)}\n`);
  console.log(`Imported ${files.size} files from ${repo}@${tag.slice(0, 7)} into docs/survey/.`);
}

await main();
