/**
 * Yields to the browser so a pending input or paint can run in the middle of a long loop.
 * `scheduler.yield()` resumes ahead of other queued tasks. Where it is missing (Safari),
 * a macrotask is the fallback.
 */
export function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof s?.yield === "function") return s.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** 50 ms is where a task becomes a long task. */
export const TASK_BUDGET_MS = 50;
