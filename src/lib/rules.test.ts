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

/** A file's code with line and block comments blanked, so a rule reads what runs, not what is explained. */
const code = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ""))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

describe("the server is the authority (#36): no processing, datum logic or file paths in the UI", () => {
  it("does geodesy (trig) only in geo.ts, the approximate measures while drawing", () => {
    const trig = sources("src").filter((f) => /Math\.(sin|cos|tan|asin|acos|atan2?)\b/.test(code(f)));
    expect(trig).toEqual(["src/lib/geo.ts"]);
  });

  it("names EPSG codes only as chips, presets, the kit's truths, a refusal and a placeholder, and never carries a projection definition", () => {
    const epsg = sources("src").filter((f) => /EPSG:\d/.test(code(f)));
    expect(epsg).toEqual([
      "src/components/workspace/panels/capture.tsx",
      "src/lib/datum.ts",
      "src/lib/demoKit.ts",
      "src/lib/workflow.ts",
    ]);
    for (const f of sources("src")) expect(code(f), f).not.toMatch(/\+proj=|\b(PROJCS|GEOGCS|PROJCRS|GEOGCRS)\[/);
  });

  it("decodes product data (point arrays, raster pixels) only in the 3D view, for display", () => {
    const decoders = sources("src").filter((f) => /\bFloat(32|64)Array\b|getImageData\(|from ["'](copc|laz-perf)["']|import\(["'](copc|laz-perf)["']\)/.test(code(f)));
    expect(decoders).toEqual(["src/components/workspace/PointView.tsx"]);
  });

  it("never holds a server file path: inputs are names from /inputs, products are addressed by kind", () => {
    const absPath = /["'`](\/(data|home|mnt|srv|tmp|var|opt|root|Users)\/|[A-Za-z]:\\\\)/;
    for (const f of sources("src")) expect(code(f), f).not.toMatch(absPath);
  });
});

describe("the demo/live choice (#38) is staticDemo(), a build-time constant, never runtime state", () => {
  it("never branches on the host the page is served from", () => {
    for (const f of sources("src")) {
      expect(code(f), f).not.toMatch(/\blocation\.(host|hostname|origin|port|protocol)\b/);
      expect(code(f), f).not.toMatch(/dragonhound\.dev|\.pages\.dev/);
    }
  });

  it("names the tape only in demo.ts and the static build's page list, and reads it only through staticApi.ts", () => {
    expect(sources("src").filter((f) => /data-tape/.test(code(f)))).toEqual(["src/app/jobs/[id]/page.tsx", "src/lib/demo.ts"]);
    expect(code("src/app/jobs/[id]/page.tsx")).toMatch(/generateStaticParams = staticDemo\(\) \?/);
    expect(sources("src").filter((f) => f !== "src/lib/demo.ts" && /\btapeBase\(/.test(code(f)))).toEqual([
      "src/components/Dashboard.tsx",
      "src/lib/staticApi.ts",
    ]);
    expect(sources("src").filter((f) => /from ["']@\/lib\/staticApi["']/.test(code(f)))).toEqual([
      "src/components/Dashboard.tsx",
      "src/components/workspace/Workspace.tsx",
      "src/lib/surveyApi.ts",
    ]);
  });

  it("hands a call to the tape only under staticDemo() in surveyApi.ts", () => {
    const lines = code("src/lib/surveyApi.ts").split("\n");
    const replays = lines.flatMap((l, i) => (/\btape\.\w+[<(]/.test(l) ? [i] : []));
    expect(replays.length).toBeGreaterThan(5);
    for (const i of replays) expect(lines.slice(Math.max(0, i - 2), i + 1).join("\n"), `surveyApi.ts:${i + 1}`).toMatch(/staticDemo\(\)/);
  });
});
