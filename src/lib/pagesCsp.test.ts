import { describe, expect, it } from "vitest";
import { headers, inlineScriptHashes, policy, sameOriginTape, withCsp } from "../../scripts/csp.mjs";

describe("the hosted demo's CSP (scripts/csp.mjs)", () => {
  it("hashes exactly the page's inline scripts and allows no inline script otherwise", () => {
    const html = '<html><head><meta charset="utf-8"><script>a()</script><script src="/x.js"></script></head></html>';
    const out = withCsp(html, "/dh-theme.js");
    const [hash] = inlineScriptHashes(html);
    expect(out).toContain(`script-src 'self' https://static.cloudflareinsights.com 'wasm-unsafe-eval' ${hash};`);
    expect(out.indexOf("Content-Security-Policy")).toBeLessThan(out.indexOf("<script"));
    expect(out).toContain('<script src="/dh-theme.js"></script>');
    expect(policy([])).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(() => withCsp(out)).toThrow();
  });

  it("names no other origin but the analytics script's and sandboxes the recorded files", () => {
    // The one other origin: the Cloudflare Web Analytics script the zone adds at the edge.
    expect(policy([]).replaceAll("https://static.cloudflareinsights.com", "")).not.toMatch(/https?:/);
    expect(headers("/data-tape")).toMatch(/\/data-tape\/\*\n {2}Content-Security-Policy: default-src 'none';[^\n]*sandbox/);
    expect(headers()).toContain("frame-ancestors 'none'");
    expect(() => sameOriginTape("https://example.com/tape")).toThrow();
    expect(sameOriginTape(undefined)).toBe("/data-tape");
  });
});
