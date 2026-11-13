#!/usr/bin/env node
// Generates src/lib/generated/survey.ts from the wire schema pinned in
// schema/pins.json. argus-survey publishes it at schema/survey-wire.schema.json
// (`argus-survey schema`, built with argus_cortex.wire), so a pin is a release
// tag plus the file's sha256. Same tool as argus-studio's, plus --local.
//
//   node scripts/wire-types.mjs                  regenerate from the committed schema
//   node scripts/wire-types.mjs --check          fail on drift; reads no network or sibling repo
//   node scripts/wire-types.mjs --pull           fetch the pin's tag, update the sha256, regenerate
//   node scripts/wire-types.mjs --local <repo>   copy <repo>/schema/…, pin it as tag "local", regenerate
//
// To bump: edit the tag in pins.json, run --pull, then fix what typecheck reports.
// A "local" pin is for working against an unreleased argus-survey; replace it with a tag before a release.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pinsPath = join(root, "schema", "pins.json");
const schemaPath = (service) => join(root, "schema", `${service}-wire.schema.json`);
const outputPath = (service) => join(root, "src", "lib", "generated", `${service}.ts`);

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/**
 * Pydantic titles every property ("Rel Path"), which the compiler would turn
 * into a named alias per field. Only a model's own title should name a type.
 */
function dropPropertyTitles(node) {
  if (Array.isArray(node)) return node.map(dropPropertyTitles);
  if (node === null || typeof node !== "object") return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "title" && typeof value === "string") continue;
    if (key === "default" || key === "enum" || key === "const") {
      out[key] = value;
    } else if (key === "properties" || key === "$defs") {
      // Here the keys are field and model names, one of which could be "title".
      out[key] = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, dropPropertyTitles(v)]));
    } else {
      out[key] = dropPropertyTitles(value);
    }
  }
  return out;
}

/** Every model in the file, by name: nothing roots them, so nothing else would reach them. */
function rootedSchema(service, schema) {
  const defs = dropPropertyTitles(schema.$defs);
  for (const [name, def] of Object.entries(defs)) def.title = name;
  return {
    title: `${service}Wire`,
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(Object.keys(defs).map((name) => [name, { $ref: `#/$defs/${name}` }])),
    $defs: defs,
  };
}

async function generate(service, pin, text) {
  const banner = [
    `// Generated from ${pin.repo}@${pin.tag} schema/${service}-wire.schema.json.`,
    "// Do not edit: change schema/pins.json and run `npm run wire:pull`.",
    "",
  ].join("\n");
  return compile(rootedSchema(service, JSON.parse(text)), `${service}Wire`, {
    additionalProperties: false,
    bannerComment: banner,
    format: true,
    style: { printWidth: 120 },
  });
}

async function pull(service, pin) {
  const url = `https://raw.githubusercontent.com/${pin.repo}/${pin.tag}/schema/${service}-wire.schema.json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`);
  const text = await resp.text();
  await writeFile(schemaPath(service), text);
  return { ...pin, sha256: sha256(text) };
}

async function local(service, pin, repo) {
  const text = await readFile(join(repo, "schema", `${service}-wire.schema.json`), "utf8");
  await writeFile(schemaPath(service), text);
  return { ...pin, tag: "local", sha256: sha256(text) };
}

async function main() {
  const mode = process.argv[2];
  if (mode !== undefined && !["--check", "--pull", "--local"].includes(mode)) {
    throw new Error(`unknown option ${mode}`);
  }
  const repo = process.argv[3];
  if (mode === "--local" && !repo) throw new Error("--local needs the argus-survey checkout, e.g. ../argus-survey");
  const pins = JSON.parse(await readFile(pinsPath, "utf8"));
  const problems = [];

  for (const [service, listed] of Object.entries(pins)) {
    const pin =
      mode === "--pull" ? await pull(service, listed) : mode === "--local" ? await local(service, listed, repo) : listed;
    pins[service] = pin;
    const text = await readFile(schemaPath(service), "utf8");
    if (sha256(text) !== pin.sha256) {
      problems.push(`schema/${service}-wire.schema.json is not the file pinned at ${pin.repo}@${pin.tag}`);
      continue;
    }
    const generated = await generate(service, pin, text);
    if (mode !== "--check") {
      await mkdir(dirname(outputPath(service)), { recursive: true });
      await writeFile(outputPath(service), generated);
      continue;
    }
    const committed = await readFile(outputPath(service), "utf8").catch(() => null);
    if (committed !== generated) {
      problems.push(`src/lib/generated/${service}.ts does not match ${pin.repo}@${pin.tag}`);
    }
  }

  if (mode === "--pull" || mode === "--local") await writeFile(pinsPath, `${JSON.stringify(pins, null, 2)}\n`);
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    console.error("Run `npm run wire:types` to regenerate, or `npm run wire:pull` after changing a pin.");
    process.exit(1);
  }
  console.log(mode === "--check" ? "Generated wire types match the pinned schemas." : "Wire types written.");
}

await main();
