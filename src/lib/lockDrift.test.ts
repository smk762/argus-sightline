import { describe, expect, it } from "vitest";
import { lockChurn } from "../../scripts/lock-drift.mjs";

type Pkgs = Record<string, { name?: string; version?: string; resolved?: string; integrity?: string }>;
const lock = (packages: Pkgs, lockfileVersion = 3, root = "x") => ({ lockfileVersion, packages: { "": { name: root }, ...packages } });
const pkg = (version: string) => ({ version, resolved: `https://registry.npmjs.org/p/-/p-${version}.tgz`, integrity: `sha512-${version}` });

describe("lockChurn (scripts/lock-drift.mjs, CI's lock-drift check)", () => {
  it("counts entries added, removed and moved, and ignores the root (package.json's own entry)", () => {
    const base = lock({ "node_modules/a": pkg("1.0.0"), "node_modules/b": pkg("2.0.0"), "node_modules/c": pkg("3.0.0") });
    const head = lock({ "node_modules/a": pkg("1.1.0"), "node_modules/b": pkg("2.0.0"), "node_modules/d": pkg("4.0.0") }, 3, "renamed");
    expect(lockChurn(base, head)).toMatchObject({
      changed: ["node_modules/a"],
      added: ["node_modules/d"],
      removed: ["node_modules/c"],
      total: 3,
      versionMoved: false,
    });
  });

  it("sees a regenerated lock: every transitive entry moves, or the lockfileVersion does", () => {
    const n = 200;
    const base = lock(Object.fromEntries(Array.from({ length: n }, (_, i) => [`node_modules/p${i}`, pkg("1.0.0")])));
    const regen = lock(Object.fromEntries(Array.from({ length: n }, (_, i) => [`node_modules/p${i}`, pkg("1.0.1")])));
    expect(lockChurn(base, regen).total).toBe(n);
    expect(lockChurn(base, lock(base.packages, 2)).versionMoved).toBe(true);
    expect(lockChurn(base, base).total).toBe(0);
  });

  it("refuses a lock without `packages` (lockfileVersion 1)", () => {
    expect(() => lockChurn({ lockfileVersion: 1 }, lock({}))).toThrow(/packages/);
  });
});
