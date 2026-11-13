import { describe, expect, it } from "vitest";
import { buildCsp, cspMode, newNonce } from "./csp";

describe("csp", () => {
  it("is nonce-based and strict", () => {
    const csp = buildCsp("abc");
    expect(csp).toContain("script-src 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it("allows what the map and point view need, and eval only in dev", () => {
    expect(buildCsp("n")).toContain("'wasm-unsafe-eval'");
    expect(buildCsp("n")).toContain("worker-src 'self' blob:");
    expect(buildCsp("n")).not.toContain("'unsafe-eval'");
    expect(buildCsp("n", { dev: true })).toContain("'unsafe-eval'");
  });

  it("defaults to enforce", () => {
    expect(cspMode(undefined)).toBe("enforce");
    expect(cspMode("bogus")).toBe("enforce");
    expect(cspMode(" OFF ")).toBe("off");
    expect(cspMode("report-only")).toBe("report-only");
  });

  it("makes a fresh 128-bit nonce each time", () => {
    const a = newNonce();
    expect(atob(a)).toHaveLength(16);
    expect(newNonce()).not.toBe(a);
  });
});
