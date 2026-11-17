// Shape checks for CLAUDE.md's "Must never happen" rules that a grep can hold. Each is deliberately narrow:
// it catches the obvious breach, and a failure means "ask first", not "the rule allows this".
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** Source files under `dir` (posix paths from the repo root), tests and generated types left out. */
function sources(dir: string): string[] {
  return readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name))
    .map((e) => relative(root, join(e.parentPath, e.name)).split(sep).join("/"))
    .filter((f) => !f.startsWith("src/lib/generated/"))
    .sort();
}

describe("dependencies", () => {
  it("are only the ones CLAUDE.md lists; a new one needs the owner's yes first", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(Object.keys(pkg.dependencies).sort()).toEqual(
      ["copc", "laz-perf", "maplibre-gl", "marked", "next", "react", "react-dom", "three"].sort(),
    );
  });
});

describe("no server-side proxy", () => {
  it("has no route handler but the docs image route, and no rewrites", () => {
    const routes = sources("src/app").filter((f) => /\/route(\.live)?\.ts$/.test(f));
    expect(routes).toEqual(["src/app/docs/survey/img/[name]/route.live.ts"]);
    expect(read("src/app/docs/survey/img/[name]/route.live.ts")).not.toMatch(/\bfetch\(|surveyUrl/);
    expect(read("next.config.ts")).not.toMatch(/\brewrites\b/);
    expect(read("src/proxy.live.ts")).not.toMatch(/\bfetch\(|NextResponse\.rewrite|surveyUrl/);
  });
});

describe("config", () => {
  it("is never read at module scope", () => {
    const moduleScope = /^(export\s+)?(const|let|var)\s+[^=(]+=\s*(runtimeConfig|surveyUrl)\(\)/m;
    for (const f of sources("src")) expect(moduleScope.test(read(f)), f).toBe(false);
  });

  it("comes from process.env only in demo.ts (build-time), runtimeConfig.ts and the live proxy", () => {
    const readers = sources("src").filter((f) => /process\.env\b/.test(read(f).replace(/^\s*(\/\/|\*).*$/gm, "")));
    expect(readers).toEqual(["src/lib/demo.ts", "src/lib/runtimeConfig.ts", "src/proxy.live.ts"]);
  });
});

describe("geo.ts", () => {
  it("measures only where the UI draws (≈ figures), never in the API client or a deliverable", () => {
    const users = sources("src").filter((f) => f !== "src/lib/geo.ts" && /\b(lineLength|ringArea)\b/.test(read(f)));
    expect(users).toEqual(["src/components/workspace/MapView.tsx", "src/components/workspace/panels/measure.tsx"]);
  });
});

describe("map shortcuts", () => {
  it("skip editable targets wherever a page-wide keydown listener is added", () => {
    const listeners = sources("src").filter((f) => /\b(window|document)\.addEventListener\(\s*["']key(down|up|press)["']/.test(read(f)));
    expect(listeners.length).toBeGreaterThan(0);
    for (const f of listeners) expect(read(f), f).toMatch(/if \(isEditable\(e\.target\)\) return;/);
  });
});
