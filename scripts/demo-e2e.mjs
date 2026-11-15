#!/usr/bin/env node
// Browser check for the hosted demo (the static build in out/): the home page, the recorded job (map,
// 3D points, a replayed step, a step the recording doesn't have) and a docs page, at 1440 and 390 px in
// light and dark, with no console error, failed request or CSP violation. Saves screenshots.
//
//   make pages && node scripts/demo-e2e.mjs [out | https://preview.example] [screenshot-dir]
//
// Needs Playwright and a Chromium it can launch. It is not a dependency of the app: point PLAYWRIGHT_DIR at a
// folder whose node_modules holds `playwright` (and CHROMIUM at a browser binary if its own is not installed). Serves out/ itself with HTTP range support, which the 3D view
// needs (copc.js reads the COPC by range), as the static host does. Adapted from argus-cull's sidebar-e2e.mjs.
import { createServer } from "node:http";
import { mkdir, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join, normalize, resolve } from "node:path";

const target = process.argv[2] ?? new URL("../out", import.meta.url).pathname;
const shots = process.argv[3] ?? null;
const remote = /^https?:\/\//.test(target);
const root = remote ? null : resolve(target);
const require = createRequire(join(resolve(process.env.PLAYWRIGHT_DIR ?? "."), "node_modules/"));
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("demo-e2e: playwright not found; set PLAYWRIGHT_DIR to a folder with node_modules/playwright");
  process.exit(2);
}

const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon", ".wasm": "application/wasm", ".woff2": "font/woff2", ".txt": "text/plain",
  ".webmanifest": "application/manifest+json", ".md": "text/markdown",
};

/** out/ over HTTP: trailing-slash pages, the CSP and frame headers from _headers' first block, and Range. */
async function serve() {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = normalize(join(root, path));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    try {
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    } catch {
      try {
        await stat(`${file}.html`);
        file = `${file}.html`;
      } catch {
        file = join(root, "404.html");
        res.statusCode = 404;
      }
    }
    const body = await readFile(file);
    res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    res.setHeader("Accept-Ranges", "bytes");
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
    if (range && res.statusCode === 200) {
      const start = range[1] === "" ? body.length - Number(range[2]) : Number(range[1]);
      const end = range[1] === "" || range[2] === "" ? body.length - 1 : Math.min(Number(range[2]), body.length - 1);
      res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${body.length}`, "Content-Length": end - start + 1 });
      return res.end(body.subarray(start, end + 1));
    }
    res.end(body);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

const { server, base } = remote ? { server: null, base: target.replace(/\/+$/, "") } : await serve();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const problems = [];
if (shots) await mkdir(shots, { recursive: true });

/**
 * A Next.js router fetch: an RSC payload or a prefetch, by its headers or `_rsc` query, the static export's .txt
 * payloads, or the HEAD a static export's segment prefetch sends to a page URL first (to follow redirects; it
 * carries no RSC headers). The app itself never sends HEAD.
 */
function isNextPrefetch(request) {
  if (request.resourceType() !== "fetch") return false;
  const h = request.headers();
  if (h.rsc === "1" || h["next-router-prefetch"] || h["next-router-state-tree"]) return true;
  const url = new URL(request.url());
  return request.method() === "HEAD" || url.searchParams.has("_rsc") || url.pathname.endsWith(".txt");
}

async function visit(width, scheme) {
  const noOverlap = async (a, b, what) => {
    const [ra, rb] = [await a.boundingBox(), await b.boundingBox()];
    if (ra && rb && ra.x < rb.x + rb.width && rb.x < ra.x + ra.width && ra.y < rb.y + rb.height && rb.y < ra.y + ra.height)
      problems.push(`${width}-${scheme} layout: ${what} covers the view toggle`);
  };
  const context = await browser.newContext({ viewport: { width, height: width > 600 ? 900 : 844 }, colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const tag = `${width}-${scheme}`;
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`${tag} console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`${tag} pageerror: ${e.message}`));
  page.on("requestfailed", (r) => {
    const error = r.failure()?.errorText ?? "";
    // Leaving a page cancels Next.js's own prefetch and RSC payload requests (net::ERR_ABORTED): the router
    // dropping work it no longer needs, not a failure. Anything else that fails, or any abort elsewhere, counts.
    if (error === "net::ERR_ABORTED" && isNextPrefetch(r)) return;
    problems.push(`${tag} failed: ${r.url()} ${error}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`${tag} HTTP ${r.status()}: ${r.url()}`);
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => console.error(`CSP: ${e.violatedDirective} ${e.blockedURI}`));
  });
  const shot = async (name) => shots && page.screenshot({ path: join(shots, `sightline-${name}-${tag}.png`) });

  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  // A link only once the recording's job list has loaded (a disabled button until then).
  await page.getByRole("link", { name: /Open the recorded job/ }).waitFor();
  await page.locator("text=m³").first().waitFor();
  await shot("home");

  await page.getByRole("link", { name: /Open the recorded job/ }).click();
  await page.waitForURL(/\/jobs\/usgs-3dep\/?$/);
  await page.locator(".maplibregl-canvas").waitFor();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500); // the map's fit animation
  await shot("job");
  // The Map / 3D points / Split control (a group of buttons).
  const toggle = page.getByRole("button", { name: "3D points", exact: true }).locator("..");
  await noOverlap(toggle, page.getByRole("button", { name: /^Layers/ }).locator(".."), "Map: Layers panel");

  // A measure step the recording ran: its polygon on the map, and the replay into the console.
  await page.getByRole("button", { name: /Stockpile volume/ }).first().click();
  await page.getByRole("button", { name: "Replay the recorded run" }).click();
  await page.getByText("✓ volume finished").waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await shot("volume");

  // A step the recording has no inputs for says so instead of showing its form.
  await page.getByRole("button", { name: /Accuracy/ }).first().click();
  await page.getByText("Not in this demo").waitFor();

  // The classified cloud, streamed from the tape by range requests.
  await page.getByRole("radio", { name: "3D points" }).or(page.getByRole("button", { name: "3D points" })).first().click();
  // Below lg its "Colour by" panel starts collapsed under the view toggle; it must never cover the toggle.
  const colourBy = page.getByRole("button", { name: "Colour by" });
  await colourBy.waitFor();
  await noOverlap(toggle, colourBy, "3D points: Colour by panel");
  if ((await colourBy.getAttribute("aria-expanded")) === "false") {
    await page.waitForTimeout(1500);
    await shot("points-collapsed");
    await colourBy.click();
  }
  await page.getByText(/classified cloud/).waitFor({ timeout: 30000 });
  await noOverlap(toggle, colourBy.locator(".."), "3D points: Colour by panel (open)");
  await page.waitForTimeout(1000);
  await shot("points");

  // Map and points side by side.
  await page.getByRole("radio", { name: "Split" }).or(page.getByRole("button", { name: "Split" })).first().click();
  await page.waitForTimeout(1500);
  await noOverlap(toggle, colourBy.locator(".."), "Split: Colour by panel");
  await noOverlap(toggle, page.getByRole("button", { name: /^Layers/ }).locator(".."), "Split: map Layers panel");
  await shot("split");

  await page.goto(`${base}/docs/survey/steps/`, { waitUntil: "networkidle" });
  await page.locator("article h1, article h2").first().waitFor();
  await shot("docs");
  await context.close();
}

try {
  for (const width of [1440, 390]) for (const scheme of ["light", "dark"]) await visit(width, scheme);
} catch (err) {
  problems.push(`flow: ${err.message.split("\n")[0]}`);
} finally {
  await browser.close();
  server?.close();
}
if (problems.length) {
  console.error(`demo-e2e: ${problems.length} problem(s)\n  ${[...new Set(problems)].join("\n  ")}`);
  process.exit(1);
}
console.log(`demo-e2e: home, job, replay, not-recorded step, 3D points and docs clean at 1440/390 in light and dark${shots ? `; screenshots in ${shots}` : ""}`);
