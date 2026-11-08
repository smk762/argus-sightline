"use client";

import { createContext, useContext } from "react";
import type { HealthInfo, JobDigest, JobSidecar } from "@/lib/generated/survey";
import type { DemoKit } from "@/lib/demoKit";
import type { LonLat } from "@/lib/geo";
import type { Inputs, StepId } from "@/lib/surveyApi";
import type { StepDef } from "@/lib/workflow";

export type DrawKind = "polygon" | "line";

export interface Drawn {
  kind: DrawKind;
  coords: LonLat[];
}

export type LogKind = "start" | "step" | "command" | "warning" | "done" | "error" | "info";

export interface LogLine {
  id: number;
  at: number;
  kind: LogKind;
  text: string;
  detail?: string;
}

export interface RunOutcome {
  ok: boolean;
  error?: string;
  stderr?: string | null;
  result?: Record<string, unknown>;
}

export interface WorkspaceState {
  jobId: string;
  sidecar: JobSidecar | null;
  health: HealthInfo | null;
  inputs: Inputs | null;
  jobs: JobDigest[];
  kit: DemoKit | null;
  demo: boolean;
  canWrite: boolean;
  running: { step: StepId; startedAt: number; sub?: string } | null;
  selected: StepDef["id"];
  select: (step: StepDef["id"]) => void;
  run: (step: StepId, body: object) => Promise<RunOutcome>;
  results: Partial<Record<StepId, Record<string, unknown>>>;
  drawing: DrawKind | null;
  drawn: Drawn | null;
  startDrawing: (kind: DrawKind) => void;
  finishDrawing: (d: Drawn | null) => void;
  clearDrawn: () => void;
  mapVersion: number;
  showPoints: () => void;
}

export const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside <Workspace>");
  return ctx;
}
