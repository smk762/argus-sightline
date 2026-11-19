/**
 * Choosing which COPC octree nodes to draw for a point budget. A COPC's hierarchy can be paged: the root page
 * holds the coarse levels and points (by key) at child pages for the deeper ones. Reading only the root page
 * stops well short of a large budget on a big cloud, so the child pages are walked breadth-first, as far as the
 * budget reaches.
 */

export interface HierarchyNode {
  pointCount: number;
}

export interface HierarchySubtree<N extends HierarchyNode, P> {
  nodes: Record<string, N | undefined>;
  pages: Record<string, P | undefined>;
}

export interface NodeChoice<N extends HierarchyNode> {
  /** Every non-empty node read, by key. */
  nodes: Record<string, N>;
  /** The keys to draw, coarsest level first. */
  chosen: string[];
  /** Their points. */
  total: number;
}

/** A node key is `depth-x-y-z`. */
export const depthOf = (key: string): number => Number(key.split("-")[0]);

/** Coarsest levels first, stopping at the first node that would take the total past `budget`. */
function pick<N extends HierarchyNode>(nodes: Record<string, N>, budget: number): NodeChoice<N> & { stopDepth: number } {
  const keys = Object.keys(nodes).sort((a, b) => depthOf(a) - depthOf(b));
  const chosen: string[] = [];
  let total = 0;
  for (const k of keys) {
    const c = nodes[k].pointCount;
    if (total + c > budget) return { nodes, chosen, total, stopDepth: depthOf(k) };
    chosen.push(k);
    total += c;
  }
  return { nodes, chosen, total, stopDepth: Number.POSITIVE_INFINITY };
}

/**
 * The nodes to draw for `budget` points. Starting from `root`, a child page is loaded whenever it could hold a node
 * at or above the level the budget currently runs out at (a page keyed `d-…` holds levels `d` and deeper), so the
 * pick is the same one a fully read hierarchy would give, without reading pages the budget never reaches.
 */
export async function chooseNodes<N extends HierarchyNode, P>(
  root: P,
  loadPage: (page: P) => Promise<HierarchySubtree<N, P>>,
  budget: number,
): Promise<NodeChoice<N>> {
  const nodes: Record<string, N> = {};
  const pending = new Map<string, P>();
  const merge = (sub: HierarchySubtree<N, P>) => {
    for (const [k, n] of Object.entries(sub.nodes)) if (n && n.pointCount > 0) nodes[k] = n;
    for (const [k, p] of Object.entries(sub.pages)) if (p) pending.set(k, p);
  };
  merge(await loadPage(root));
  for (;;) {
    const { stopDepth, ...choice } = pick(nodes, budget);
    const due = [...pending].filter(([k]) => depthOf(k) <= stopDepth);
    if (!due.length) return choice;
    for (const [k] of due) pending.delete(k);
    for (const sub of await Promise.all(due.map(([, p]) => loadPage(p)))) merge(sub);
  }
}
