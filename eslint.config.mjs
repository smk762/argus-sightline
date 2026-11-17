import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated from the pinned wire schema (npm run wire:types); never hand-edited.
    "src/lib/generated/**",
    // MapLibre's worker bundle, copied in by postinstall (scripts/copy-wasm.mjs).
    "public/maplibre-gl-worker.mjs",
    // Claude Code's agent worktrees: other checkouts of this repo, linted in their own right.
    ".claude/**",
  ]),
]);

export default eslintConfig;
