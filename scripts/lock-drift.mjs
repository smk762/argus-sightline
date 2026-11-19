// Fail when package-lock.json moves more packages than a dependency change explains (CLAUDE.md, "Must never
// happen": the lockfile is re-resolved from scratch).
//
// npm 10's arborist crashes (`edgesOut`) resolving vitest 4's optional peers from scratch, so the lock was seeded
// from argus-studio's and is only ever updated from an existing lock. `npm ci` already refuses a lock out of step
// with package.json, but a lock deleted and regenerated (when that happens to succeed) passes it and silently moves
// every transitive version. A real bump moves a handful of entries (maplibre-gl 5 → 6 moved 15); a regenerated
// lock moves hundreds. So: compare with the base branch's lock and fail above --max.
//
//   node scripts/lock-drift.mjs [base-ref] [--max N]     (default origin/dev, 60)
//
// A deliberate large move (a framework major, a planned re-seed) sets LOCK_CHURN_OK=1; CI sets it from the PR's
// `deps:lock` label.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Entries of a v2/v3 lock keyed by install path, as `version|resolved|integrity`. The root ("") is package.json's. */
function entries(lock) {
  if (!lock.packages) throw new Error("not a lockfileVersion 2/3 lock (no `packages`)");
  return new Map(
    Object.entries(lock.packages)
      .filter(([path]) => path !== "")
      .map(([path, p]) => [path, `${p.version ?? ""}|${p.resolved ?? ""}|${p.integrity ?? ""}`]),
  );
}

/** Install paths added, removed or moved to another version between two parsed locks. */
export function lockChurn(base, head) {
  const a = entries(base);
  const b = entries(head);
  const added = [...b.keys()].filter((k) => !a.has(k));
  const removed = [...a.keys()].filter((k) => !b.has(k));
  const changed = [...b.keys()].filter((k) => a.has(k) && a.get(k) !== b.get(k));
  const versionMoved = base.lockfileVersion !== head.lockfileVersion;
  return { added, removed, changed, versionMoved, total: added.length + removed.length + changed.length };
}

function main(argv) {
  const maxAt = argv.indexOf("--max");
  const max = maxAt >= 0 ? Number(argv[maxAt + 1]) : 60;
  const ref = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--max") ?? "origin/dev";
  const root = fileURLToPath(new URL("..", import.meta.url));
  let baseText;
  try {
    baseText = execFileSync("git", ["show", `${ref}:package-lock.json`], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 });
  } catch {
    console.error(`lock-drift: cannot read package-lock.json at ${ref} (fetch it first: git fetch origin <branch>)`);
    process.exit(2);
  }
  const churn = lockChurn(JSON.parse(baseText), JSON.parse(readFileSync(`${root}/package-lock.json`, "utf8")));
  const sample = [...churn.changed, ...churn.added.map((k) => `+${k}`), ...churn.removed.map((k) => `-${k}`)].slice(0, 15);
  console.log(`lock-drift: ${churn.total} entries moved against ${ref} (max ${max})${sample.length ? `: ${sample.join(", ")}${churn.total > sample.length ? ", …" : ""}` : ""}`);
  const bad = churn.versionMoved || churn.total > max;
  if (!bad) return;
  const why = churn.versionMoved ? "lockfileVersion changed" : `${churn.total} entries moved`;
  if (process.env.LOCK_CHURN_OK === "1") {
    console.log(`lock-drift: ${why}, allowed by LOCK_CHURN_OK=1`);
    return;
  }
  console.error(
    `lock-drift: ${why}. That looks like a lock regenerated from scratch, which moves every transitive version ` +
      "(and npm 10 can crash doing it). Restore the base lock and update from it (npm install <pkg>@<version>). " +
      "If the move is deliberate, label the PR deps:lock.",
  );
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
