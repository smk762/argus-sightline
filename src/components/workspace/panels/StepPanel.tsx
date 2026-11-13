"use client";

import { useState, type ReactNode } from "react";
import { relError } from "@/lib/demoKit";
import type { StepId } from "@/lib/surveyApi";
import { STEPS, stepState } from "@/lib/workflow";
import { madeWith, type MadeWith } from "@/lib/provenance";
import { docsUrl, shortSha, sourceUrl, SURVEY } from "@/lib/surveyDocs";
import { Banner, Button, ExternalLink, KV, Pill, Spinner } from "@/components/ui";
import { useWorkspace, type RunOutcome } from "@/components/workspace/context";
import { IngestPanel, QaPanel } from "@/components/workspace/panels/capture";
import { ContoursPanel, GroundPanel, SurfacesPanel } from "@/components/workspace/panels/model";
import { AccuracyPanel, ChangePanel, CutfillPanel, ProfilePanel, VolumePanel } from "@/components/workspace/panels/measure";
import { ReportPanel } from "@/components/workspace/panels/deliver";

const PANELS = {
  ingest: IngestPanel,
  qa: QaPanel,
  ground: GroundPanel,
  surfaces: SurfacesPanel,
  contours: ContoursPanel,
  volume: VolumePanel,
  cutfill: CutfillPanel,
  change: ChangePanel,
  accuracy: AccuracyPanel,
  profile: ProfilePanel,
  report: ReportPanel,
} as const;

export function StepPanel() {
  const ws = useWorkspace();
  const def = STEPS.find((s) => s.id === ws.selected)!;
  const st = stepState(def.id, ws.sidecar);
  const Panel = PANELS[def.id];
  const idx = STEPS.indexOf(def);
  const next = STEPS[idx + 1];
  const made = madeWith(ws.sidecar, def.id);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {def.group} · step {idx + 1} of {STEPS.length}
          </div>
          <h2 className="text-[17px] font-semibold">{def.label}</h2>
          <p className="text-[12.5px] text-muted">
            {def.blurb} ·{" "}
            <ExternalLink href={docsUrl(def.id)} className="text-accent underline-offset-2 hover:underline">
              Reference
            </ExternalLink>
          </p>
        </div>
        <Pill tone={st.status === "done" ? "ok" : st.status === "ready" ? "accent" : "neutral"}>
          {st.status === "done" ? "done" : st.status === "ready" ? "ready" : "waiting"}
        </Pill>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        {st.status === "blocked" && st.reason && <Banner tone="warn">{st.reason}</Banner>}
        <Panel blocked={st.status === "blocked"} />
        {made && <MadeWithLine made={made} />}
      </div>
      {next && st.status === "done" && (
        <div className="border-t border-line px-4 py-2.5">
          <Button size="sm" variant="ghost" className="w-full justify-between" onClick={() => ws.select(next.id)}>
            <span className="text-muted">Next</span>
            <span>{next.label} →</span>
          </Button>
        </div>
      )}
    </div>
  );
}

/** "Computed by argus-survey <version>, `<step>` with <params>": read from job.json, never hard-coded. */
function MadeWithLine({ made }: { made: MadeWith }) {
  const clip = (v: string) => (v.length > 40 ? `${v.slice(0, 39)}…` : v);
  const summary = made.params.slice(0, 2).map(([k, v]) => `${k} ${clip(v)}`).join(", ");
  return (
    <details className="rounded-md border border-line bg-panel-2 px-3 py-2 text-[12px] text-muted">
      <summary className="cursor-pointer">
        Computed by <strong className="font-semibold text-ink-2">argus-survey {made.version}</strong>,{" "}
        <code className="num">{made.step}</code>
        {summary && <> with <span className="text-ink-2">{summary}</span></>}
        {made.params.length > 2 && !summary.endsWith("…") && " …"}
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <KV
          rows={[
            ...made.params,
            ...(made.tools.length ? ([["tools", made.tools.join(", ")]] as [string, string][]) : []),
            ...(made.products.length ? ([["wrote", made.products.join(", ")]] as [string, string][]) : []),
          ]}
        />
        <p>
          The full record is in this job&apos;s <code className="num">job.json</code> and the report. This UI is synced
          to argus-survey {SURVEY.version || "(unrecorded)"} @{" "}
          <ExternalLink href={sourceUrl()} className="num text-accent underline-offset-2 hover:underline">
            {shortSha(SURVEY.commit)}
          </ExternalLink>
          {" · "}
          <ExternalLink href={docsUrl(made.step)} className="text-accent underline-offset-2 hover:underline">
            how this step works
          </ExternalLink>
        </p>
      </div>
    </details>
  );
}

export interface PanelProps {
  blocked: boolean;
}

/** Run a step from a panel: busy/error state plus the workspace's streaming runner. */
export function useStepRun(step: StepId) {
  const ws = useWorkspace();
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const busy = ws.running?.step === step;
  const run = async (body: object) => {
    setOutcome(null);
    const out = await ws.run(step, body);
    setOutcome(out);
    return out;
  };
  return { run, busy, outcome, anyBusy: ws.running !== null, canWrite: ws.canWrite };
}

export function RunBar({
  label,
  onRun,
  busy,
  disabled,
  outcome,
  secondary,
  why,
}: {
  label: string;
  onRun: () => void;
  busy: boolean;
  disabled?: boolean;
  outcome: RunOutcome | null;
  secondary?: ReactNode;
  why?: string;
}) {
  const ws = useWorkspace();
  const off = disabled || !ws.canWrite || ws.running !== null;
  const title = !ws.canWrite ? "The server is read-only (SURVEY_ALLOW_PROCESS is off)" : ws.running ? "Another step is running" : why;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="lg" className="flex-1" onClick={onRun} disabled={off} title={title}>
          {busy ? (
            <>
              <Spinner /> Running…
            </>
          ) : (
            label
          )}
        </Button>
        {secondary}
      </div>
      {why && !busy && disabled && <span className="text-[12px] text-muted">{why}</span>}
      {/* Always in the page (a region that only appears isn't reliably announced); empty, it cancels the gap. */}
      <div aria-live="polite" className="empty:-mt-2">
        {outcome && !outcome.ok && (
          <Banner tone="bad" title="Refused">
            <span className="whitespace-pre-wrap">{outcome.error}</span>
            {outcome.stderr && (
              <details className="mt-1">
                <summary className="cursor-pointer text-[12px] text-muted">tool stderr</summary>
                <pre className="num mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[11px]">{outcome.stderr}</pre>
              </details>
            )}
          </Banner>
        )}
      </div>
    </div>
  );
}

/** A tip shown only in the guided demo. */
export function DemoTip({ children }: { children: ReactNode }) {
  const ws = useWorkspace();
  if (!ws.kit || !(ws.demo || ws.jobId.startsWith("kit-"))) return null;
  return (
    <div className="rounded-md border border-accent/35 bg-accent-soft px-3 py-2 text-[12.5px] text-ink-2">
      <span className="mr-1.5 font-semibold text-accent">Demo</span>
      {children}
    </div>
  );
}

/** Measured vs the kit's analytic truth. */
export function TruthCheck({ label, measured, truth, unit, tolerance }: { label: string; measured: number; truth: number; unit: string; tolerance: number }) {
  const err = relError(measured, truth);
  const ok = Math.abs(err) <= tolerance;
  return (
    <div className={`flex items-center justify-between rounded-md border px-3 py-2 text-[12.5px] ${ok ? "border-ok/40 bg-ok-soft" : "border-warn/40 bg-warn-soft"}`}>
      <ExternalLink href={docsUrl("truth")} title="How the kit's truths are derived" className="text-ink-2 underline decoration-dotted underline-offset-2">
        {label}
      </ExternalLink>
      <span className="num">
        <span className="text-ink">
          {measured.toFixed(1)} {unit}
        </span>
        <span className="text-muted"> vs {truth.toFixed(1)} · </span>
        <span className={ok ? "text-ok" : "text-warn"}>
          {err >= 0 ? "+" : ""}
          {err.toFixed(1)} %
        </span>
      </span>
    </div>
  );
}
