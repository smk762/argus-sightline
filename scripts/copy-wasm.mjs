#!/usr/bin/env node
// laz-perf decodes COPC chunks in WebAssembly. Serve its .wasm from our own origin
// (public/) rather than a CDN, so the point view works offline and under a strict CSP.
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve("laz-perf/package.json"));
await mkdir(join(root, "public"), { recursive: true });
await copyFile(join(pkg, "lib", "web", "laz-perf.wasm"), join(root, "public", "laz-perf.wasm"));
