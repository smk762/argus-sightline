#!/usr/bin/env node
// Files the browser loads by URL, served from our own origin (public/) rather than a CDN, so the views work
// offline and under a strict CSP:
//   - laz-perf.wasm: laz-perf decodes COPC chunks in WebAssembly (the point view).
//   - maplibre-gl-worker.mjs: MapLibre 6's worker is a separate ES module that it finds next to its own
//     bundle at run time, which a bundled chunk is not; MapView points it here with setWorkerUrl().
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve("laz-perf/package.json"));
await mkdir(join(root, "public"), { recursive: true });
await copyFile(join(pkg, "lib", "web", "laz-perf.wasm"), join(root, "public", "laz-perf.wasm"));
const maplibre = dirname(require.resolve("maplibre-gl/package.json"));
await copyFile(join(maplibre, "dist", "maplibre-gl-worker.mjs"), join(root, "public", "maplibre-gl-worker.mjs"));
