// The vendored Dragonhound shared layer (vendor/dh/). The files themselves are pinned by
// `node vendor/dh/sync-shared.mjs --check .` in CI; this pins what the app builds from them.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DemoStrip, STRIP_SITE } from "@/components/DemoStrip";
import { strip, stripHtml } from "../../vendor/dh/dh-strip.mjs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const squash = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/<(path)([^>]*)\/>/g, "<$1$2></$1>")
    .trim();
// The JSX strip carries data-dh-site on the <nav> (dh-strip.css marks the current link from it).
const rendered = (current?: string) =>
  renderToStaticMarkup(createElement(DemoStrip, current ? { current } : {})).replace(/<nav ([^>]*) data-dh-site="[a-z]+">/, "<nav $1>");

describe("dh-strip", () => {
  it("renders the shared source's markup", () => {
    expect(rendered()).toBe(squash(stripHtml({ current: STRIP_SITE, label: strip.defaultLabel })));
    expect(rendered("cull")).toBe(squash(stripHtml({ current: "cull", label: strip.defaultLabel })));
  });

  it("says this is sightline on the nav, with the default recorded-output label", () => {
    const html = renderToStaticMarkup(createElement(DemoStrip));
    expect(html).toContain('<nav class="dh-strip" aria-label="Dragonhound Labs demos" data-dh-site="sightline">');
    expect(html).toContain(strip.labelMore);
    expect(html).not.toContain("target=");
  });

  it("marks the Sightline link current, and only it (dh-shared 1.2.5)", () => {
    const html = renderToStaticMarkup(createElement(DemoStrip));
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('<a href="https://sightline.dragonhound.dev/" data-dh-site="sightline" aria-current="page">Sightline</a>');
  });
});

describe("dh-theme", () => {
  it("serves the vendored script unchanged", () => {
    expect(read("public/dh-theme.js")).toBe(read("vendor/dh/dh-theme.js"));
  });

  it("is the only theme code in the live layout, which keeps its per-request headers() call", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('src="/dh-theme.js"');
    // headers() makes every live route dynamic, which force-dynamic can't say in a file shared with the static export.
    expect(layout).toMatch(/await headers\(\)/);
    expect(layout).not.toContain("localStorage");
  });
});
