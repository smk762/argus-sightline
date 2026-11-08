"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HealthInfo, JobDigest, JobSidecar } from "@/lib/generated/survey";
import { findKit } from "@/lib/demoKit";
import {
  getHealth,
  getInputs,
  getJob,
  listJobs,
  productUrl,
  Refused,
  runStep,
  StepFailed,
  type Inputs,
  type StepId,
  type SurveyEvent,
} from "@/lib/surveyApi";
import { seconds } from "@/lib/format";
import { nextStep, type StepDef } from "@/lib/workflow";
import { AppHeader } from "@/components/AppHeader";
import { Banner, Button, cx, Segmented, Spinner } from "@/components/ui";
import { Console } from "@/components/workspace/Console";
import { DatumChips } from "@/components/workspace/DatumChips";
import { MapView } from "@/components/workspace/MapView";
import { PointView } from "@/components/workspace/PointView";
import { StepPanel } from "@/components/workspace/panels/StepPanel";
import { StepRail } from "@/components/workspace/StepRail";
import {
  WorkspaceContext,
  type DrawKind,
  type Drawn,
  type LogLine,
  type RunOutcome,
  type WorkspaceState,
} from "@/components/workspace/context";

type View = "map" | "points" | "split";

export function Workspace({ jobId, demo }: { jobId: string; demo: boolean }) {
  const [sidecar, setSidecar] = useState<JobSidecar | null | undefined>(undefined);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [inputs, setInputs] = useState<Inputs | null>(null);
  const [jobs, setJobs] = useState<JobDigest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StepDef["id"] | null>(null);
  const [running, setRunning] = useState<WorkspaceState["running"]>(null);
  const [results, setResults] = useState<WorkspaceState["results"]>({});
  const [log, setLog] = useState<LogLine[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [drawing, setDrawing] = useState<DrawKind | null>(null);
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const [mapVersion, setMapVersion] = useState(0);
  const [view, setView] = useState<View>("map");
  const logId = useRef(0);

  const push = useCallback((kind: LogLine["kind"], text: string, detail?: string) => {
    setLog((l) => [...l.slice(-800), { id: ++logId.current, at: Date.now(), kind, text, detail }]);
  }, []);

  const refresh = useCallback(async () => {
    const [s, j] = await Promise.all([getJob(jobId), listJobs().catch(() => [] as JobDigest[])]);
    setSidecar(s);
    setJobs(j);
    return s;
  }, [jobId]);

  useEffect(() => {
    let live = true;
    Promise.all([getHealth(), getInputs(), refresh()])
      .then(([h, i, s]) => {
        if (!live) return;
        setHealth(h);
        setInputs(i);
        setSelected((cur) => cur ?? nextStep(s) ?? "report");
      })
      .catch((e: Error) => live && setLoadError(e.message));
    return () => {
      live = false;
    };
  }, [refresh]);

  const run = useCallback(
    async (step: StepId, body: object): Promise<RunOutcome> => {
      setRunning({ step, startedAt: Date.now() });
      setConsoleOpen(true);
      push("start", `▶ ${step}`, JSON.stringify(body));
      const onEvent = (e: SurveyEvent) => {
        switch (e.event) {
          case "step":
            if (e.data.state === "start") setRunning((r) => (r ? { ...r, sub: e.data.step } : r));
            push(
              "step",
              e.data.state === "start" ? `  ${e.data.step} …` : `  ${e.data.step} done in ${seconds(e.data.seconds)}`,
            );
            break;
          case "command":
            push(
              "command",
              `    #${e.data.index} ${e.data.tool}  ${seconds(e.data.seconds)}${e.data.returncode ? `  exit ${e.data.returncode}` : ""}`,
            );
            break;
          case "warning":
            push("warning", `  ⚠ ${e.data.message}`);
            break;
          default:
            break;
        }
      };
      try {
        const done = await runStep(jobId, step, body, onEvent);
        setResults((r) => ({ ...r, [step]: done.result }));
        push("done", `✓ ${step} finished · products: ${done.products.length}`);
        const s = await refresh();
        setMapVersion((v) => v + 1);
        if (step === "ingest" || step === "run") setSelected(nextStep(s) ?? "report");
        return { ok: true, result: done.result };
      } catch (err) {
        const e = err as Error;
        const stderr = err instanceof StepFailed ? err.stderr : null;
        push("error", `✗ ${step}: ${e.message}`, stderr ?? undefined);
        if (!(err instanceof Refused)) await refresh().catch(() => undefined);
        return { ok: false, error: e.message, stderr };
      } finally {
        setRunning(null);
      }
    },
    [jobId, push, refresh],
  );

  const kit = findKit(inputs);
  const state: WorkspaceState | null = useMemo(
    () =>
      sidecar === undefined || selected === null
        ? null
        : {
            jobId,
            sidecar,
            health,
            inputs,
            jobs,
            kit,
            demo,
            canWrite: !!health && !health.read_only,
            running,
            selected,
            select: setSelected,
            run,
            results,
            drawing,
            drawn,
            startDrawing: (k) => {
              setDrawing(k);
              setDrawn(null);
              setView((v) => (v === "points" ? "map" : v));
            },
            finishDrawing: (d) => {
              setDrawing(null);
              if (d) setDrawn(d);
            },
            clearDrawn: () => setDrawn(null),
            mapVersion,
            showPoints: () => setView("points"),
          },
    [sidecar, selected, jobId, health, inputs, jobs, kit, demo, running, run, results, drawing, drawn, mapVersion],
  );

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader health={health} />
        <div className="mx-auto mt-16 max-w-lg px-4">
          <Banner tone="bad" title="Cannot open this job">
            {loadError}
          </Banner>
        </div>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader health={health} />
        <div className="flex flex-1 items-center justify-center gap-2 text-muted">
          <Spinner /> Opening <span className="num">{jobId}</span>…
        </div>
      </div>
    );
  }

  const report = state.sidecar?.products?.report;
  return (
    <WorkspaceContext.Provider value={state}>
      <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
        <AppHeader health={health}>
          <span className="text-line-strong">/</span>
          <span className="num truncate font-medium">{jobId}</span>
          {state.sidecar === null && <span className="text-[12px] text-muted">new</span>}
          <div className="hidden min-w-0 md:flex">
            <DatumChips crs={state.sidecar?.crs} sourceType={state.sidecar?.ingest?.source_type} />
          </div>
          <span className="flex-1" />
          {report && (
            <a href={productUrl(jobId, "report")} target="_blank" rel="noopener" className="hidden sm:block">
              <Button size="sm" variant="outline">
                Report ↗
              </Button>
            </a>
          )}
        </AppHeader>
        {running && <div className="sweep relative h-0.5 shrink-0 overflow-hidden bg-accent-soft" />}

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <StepRail />
          <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
            {/* An explicit height below lg: a min-height alone leaves the h-full grid (and the map) at zero. */}
            <div className="relative h-[62vh] shrink-0 lg:h-auto lg:min-h-0 lg:flex-1">
              <div className="absolute left-3 top-3 z-20">
                <Segmented
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "map", label: "Map" },
                    { value: "points", label: "3D points" },
                    { value: "split", label: "Split", title: "Map and points side by side" },
                  ]}
                />
              </div>
              <div className={cx("grid h-full", view === "split" ? "grid-cols-2 gap-px bg-line" : "grid-cols-1")}>
                <div className={cx("relative min-h-0", view === "points" && "hidden")}>
                  <MapView />
                </div>
                <div className={cx("relative min-h-0", view === "map" && "hidden")}>
                  <PointView active={view !== "map"} />
                </div>
              </div>
            </div>
            <Console lines={log} open={consoleOpen} onToggle={() => setConsoleOpen((o) => !o)} />
          </div>
          <aside className="flex w-full shrink-0 flex-col border-t border-line bg-panel lg:min-h-0 lg:w-[400px] lg:border-l lg:border-t-0">
            <div className="md:hidden border-b border-line p-3">
              <DatumChips crs={state.sidecar?.crs} sourceType={state.sidecar?.ingest?.source_type} />
            </div>
            <StepPanel />
          </aside>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}

