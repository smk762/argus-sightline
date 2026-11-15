// Post-build check for the hosted demo (`make pages`): the export is pure static files.
//
//   - no route handler was exported and no page points at an argus-survey API (:8107)
//   - every page carries the hash-based CSP <meta>, and _headers is there for the host
//   - the tape is in the export, with every file it names (map views, products), and no file is over
//     the host's 25 MiB limit
//
//   node scripts/check-static.mjs [outDir]   (run by `npm run build:pages`)
// Adapted from argus-cull's.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const out = process.argv[2] ?? "out";
const tapeDir = (process.env.NEXT_PUBLIC_SIGHTLINE_TAPE_URL || "/data-tape").replace(/^\/+|\/+$/g, "");
const MAX_FILE = 25 * 1024 * 1024;
const MAX_FILES = 20000;
const problems = [];
const files = readdirSync(out, { withFileTypes: true, recursive: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
const inTape = (f) => relative(out, f).startsWith(tapeDir + sep);
const pages = files.filter((f) => f.endsWith(".html") && !inTape(f));

if (files.length > MAX_FILES) problems.push(`${files.length} files: more than the host's ${MAX_FILES}`);
for (const f of files) if (statSync(f).size > MAX_FILE) problems.push(`${f} is over 25 MiB`);
if (existsSync(join(out, "api"))) problems.push("out/api exists: an API route was exported");
if (!existsSync(join(out, "_headers"))) problems.push("no _headers file");
// The imported survey docs name the API's port in their prose ("serve on :8107"), so there only an href or
// src that points at it counts; anywhere else, any mention does.
const docsDir = join(out, "docs");
for (const file of pages) {
  const html = readFileSync(file, "utf8");
  if (!html.includes('http-equiv="Content-Security-Policy"')) problems.push(`${file} has no CSP <meta>`);
  const port = file.startsWith(docsDir) ? /(?:href|src)="[^"]*:8107/ : /:8107|localhost/;
  if (port.test(html)) problems.push(`${file} references a live argus-survey API`);
}
const tapeJson = join(out, tapeDir, "tape.json");
if (!existsSync(tapeJson)) problems.push(`no tape at ${tapeJson}`);
else {
  const tape = JSON.parse(readFileSync(tapeJson, "utf8"));
  const need = (rel) => {
    if (!existsSync(join(out, tapeDir, rel))) problems.push(`tape file missing: ${rel}`);
  };
  for (const f of ["health.json", "doctor.json", "inputs.json", "jobs.json", tape.provenance ?? "PROVENANCE.md"]) need(f);
  for (const [job, kinds] of Object.entries(tape.views)) {
    need(`jobs/${job}/job.json`);
    for (const kind of kinds) {
      need(`jobs/${job}/web/${kind}.json`);
      const view = JSON.parse(readFileSync(join(out, tapeDir, `jobs/${job}/web/${kind}.json`), "utf8"));
      if (view.url) need(view.url);
    }
    if (!existsSync(join(out, "jobs", job, "index.html"))) problems.push(`no page exported for job ${job}`);
  }
  for (const products of Object.values(tape.products)) for (const rel of Object.values(products)) need(rel);
}
if (problems.length) {
  console.error(`check-static: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`check-static: ${files.length} files, pure static, CSP on every page, tape in ${tapeDir}/`);
