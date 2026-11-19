import { describe, expect, it } from "vitest";
import { headers, inlineScriptHashes, policy, sameOriginTape, withCsp } from "../../scripts/csp.mjs";

describe("the hosted demo's CSP (scripts/csp.mjs)", () => {
  it("hashes exactly the page's inline scripts and allows no inline script otherwise", () => {
    const html = '<html><head><meta charset="utf-8"><script>a()</script><script src="/x.js"></script></head></html>';
    const out = withCsp(html, "/dh-theme.js");
    const [hash] = inlineScriptHashes(html);
    expect(out).toContain(`script-src 'self' 'wasm-unsafe-eval' ${hash};`);
    expect(out.indexOf("Content-Security-Policy")).toBeLessThan(out.indexOf("<script"));
    expect(out).toContain('<script src="/dh-theme.js"></script>');
    expect(policy([])).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(() => withCsp(out)).toThrow();
  });

  it("names no other origin and sandboxes the recorded files", () => {
    expect(policy([])).not.toMatch(/https?:/);
    expect(headers("/data-tape")).toMatch(/\/data-tape\/\*\n {2}Content-Security-Policy: default-src 'none';[^\n]*sandbox/);
    expect(headers()).toContain("frame-ancestors 'none'");
    expect(() => sameOriginTape("https://example.com/tape")).toThrow();
    expect(sameOriginTape(undefined)).toBe("/data-tape");
  });
});
