"use client";

import { coreProgress, GROUPS, STEPS, stepState } from "@/lib/workflow";
import { cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/context";

export function StepRail() {
  const ws = useWorkspace();
  const progress = coreProgress(ws.sidecar);
  return (
    <nav
      aria-label="Survey steps"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel px-2 py-2 lg:w-[232px] lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-3 lg:py-4"
    >
      <div className="mb-3 hidden items-center gap-3 px-1 lg:flex">
        <Ring value={progress} />
        <div className="text-[12px] leading-tight">
          <div className="font-medium text-ink">{Math.round(progress * 100)} % of the core path</div>
          <div className="text-muted">ingest → report</div>
        </div>
      </div>
      {GROUPS.map((g) => (
        <div key={g} className="contents lg:flex lg:flex-col lg:gap-0.5">
          <div className="mt-2 hidden px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted lg:block">
            {g}
          </div>
          {STEPS.filter((s) => s.group === g).map((s) => {
            const st = stepState(s.id, ws.sidecar);
            const active = ws.selected === s.id;
            const isRunning = ws.running && (ws.running.step === s.id || (ws.running.step === "run" && ws.running.sub === s.id));
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => ws.select(s.id)}
                title={st.reason ?? s.blurb}
                className={cx(
                  "group flex shrink-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition",
                  active ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-raised",
                  st.status === "blocked" && !active && "opacity-55",
                )}
              >
                <StatusIcon status={st.status} running={!!isRunning} />
                <span className="whitespace-nowrap font-medium">{s.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function StatusIcon({ status, running }: { status: "done" | "ready" | "blocked"; running: boolean }) {
  if (running) return <span className="pulse inline-block size-4 rounded-full border-2 border-accent bg-accent/30" />;
  if (status === "done")
    return (
      <span className="grid size-4 place-items-center rounded-full bg-ok text-[10px] font-bold text-bg" aria-label="done">
        ✓
      </span>
    );
  if (status === "ready") return <span className="size-4 rounded-full border-2 border-accent" aria-label="ready" />;
  return <span className="size-4 rounded-full border-2 border-dashed border-line-strong" aria-label="blocked" />;
}

function Ring({ value }: { value: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden>
      <circle cx="19" cy="19" r={r} fill="none" stroke="var(--raised)" strokeWidth="4" />
      <circle
        cx="19"
        cy="19"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${c * value} ${c}`}
        transform="rotate(-90 19 19)"
        style={{ transition: "stroke-dasharray 600ms ease" }}
      />
    </svg>
  );
}
