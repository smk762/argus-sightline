import { describe, expect, it } from "vitest";
import { chooseNodes, type HierarchySubtree } from "@/lib/copcHierarchy";

type Node = { pointCount: number };
type Page = { id: string };

/**
 * A paged hierarchy: the root page holds levels 0–1 and points at child pages for 2-0-0-0 and 2-1-1-0, each
 * holding its level-2 node and one level-3 node.
 */
const PAGES: Record<string, HierarchySubtree<Node, Page>> = {
  root: {
    nodes: { "0-0-0-0": { pointCount: 100 }, "1-0-0-0": { pointCount: 100 }, "1-1-0-0": { pointCount: 0 } },
    pages: { "2-0-0-0": { id: "a" }, "2-1-1-0": { id: "b" } },
  },
  a: { nodes: { "2-0-0-0": { pointCount: 100 }, "3-0-0-0": { pointCount: 100 } }, pages: {} },
  b: { nodes: { "2-1-1-0": { pointCount: 100 }, "3-2-2-0": { pointCount: 100 } }, pages: {} },
};

function loader() {
  const read: string[] = [];
  const load = async (p: Page) => {
    read.push(p.id);
    return PAGES[p.id];
  };
  return { read, load };
}

describe("chooseNodes", () => {
  it("walks child hierarchy pages, so a budget beyond the root page gets the deeper levels", async () => {
    const { read, load } = loader();
    const { chosen, total, nodes } = await chooseNodes({ id: "root" }, load, 1_000);
    expect(read).toEqual(["root", "a", "b"]);
    expect(total).toBe(600);
    expect(chosen.slice(0, 2)).toEqual(["0-0-0-0", "1-0-0-0"]);
    expect(chosen.slice(2, 4).sort()).toEqual(["2-0-0-0", "2-1-1-0"]);
    expect(chosen.slice(4).sort()).toEqual(["3-0-0-0", "3-2-2-0"]);
    expect(Object.keys(nodes)).not.toContain("1-1-0-0"); // empty nodes are never drawn
  });

  it("stops at the first node past the budget, coarsest levels first", async () => {
    const { load } = loader();
    const { chosen, total } = await chooseNodes({ id: "root" }, load, 350);
    expect(total).toBe(300);
    expect(chosen.map((k) => k[0])).toEqual(["0", "1", "2"]);
  });

  it("reads each page once, even when a malformed page lists itself or pages point at each other", async () => {
    const cyclic: Record<string, HierarchySubtree<Node, Page>> = {
      root: { nodes: { "0-0-0-0": { pointCount: 100 } }, pages: { "1-0-0-0": { id: "a" } } },
      a: { nodes: { "1-0-0-0": { pointCount: 100 } }, pages: { "1-0-0-0": { id: "a" }, "2-0-0-0": { id: "b" } } },
      b: { nodes: { "2-0-0-0": { pointCount: 100 } }, pages: { "1-0-0-0": { id: "a" }, "2-0-0-0": { id: "b" } } },
    };
    const read: string[] = [];
    const load = async (p: Page) => {
      read.push(p.id);
      if (read.length > 20) throw new Error(`hierarchy pages re-read: ${read.join(",")}`);
      return cyclic[p.id];
    };
    const { total } = await chooseNodes({ id: "root" }, load, 1_000);
    expect(read).toEqual(["root", "a", "b"]);
    expect(total).toBe(300);
  });

  it("reads no child page the budget never reaches", async () => {
    const { read, load } = loader();
    const { chosen } = await chooseNodes({ id: "root" }, load, 150);
    expect(chosen).toEqual(["0-0-0-0"]);
    expect(read).toEqual(["root"]);
  });
});
