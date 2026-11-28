/**
 * When the 3D view (re)loads its cloud. The view keeps the key it last loaded (`<sha>:<budget>`); this says
 * what a change of job, product, budget or visibility asks of it.
 *
 * - `load`: shown, with a cloud it hasn't loaded at this budget (first view, re-ingest, re-classify, budget).
 * - `clear`: the job has no streamable cloud now (another job, or a product gone during a re-ingest) and the
 *   last one is still on screen: tear it down, or another job's points pass for this one's.
 * - `keep`: nothing to do; hidden views load when first shown.
 */
export interface CloudAction {
  action: "load" | "clear" | "keep";
  /** The key the view holds afterwards. */
  key: string | null;
}

export function cloudAction(loaded: string | null, active: boolean, sha: string | null, budget: number): CloudAction {
  if (!sha) return { action: loaded === null ? "keep" : "clear", key: null };
  const key = `${sha}:${budget}`;
  if (!active || loaded === key) return { action: "keep", key: loaded };
  return { action: "load", key };
}
