"use client";

import Link from "next/link";
import { useState } from "react";
import type { AccuracyGroup, CheckResidual, VolumeReport } from "@/lib/generated/survey";
import { KIT_JOB_1, KIT_JOB_2, KIT_TRUTH, TRUTH_TOLERANCE } from "@/lib/demoKit";
import { closeRing, lineLength, ringArea } from "@/lib/geo";
import { cm, count, m, m2, m3, num, pct } from "@/lib/format";
import { productUrl } from "@/lib/surveyApi";
import { Banner, Button, cx, Field, KV, NumberInput, Pill, Section, Segmented, Select, Stat, TextInput, Toggle } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/context";
import { DemoTip, RunBar, TruthCheck, useStepRun, type PanelProps } from "@/components/workspace/panels/StepPanel";

const vectorsOf = (v: string[] | undefined) => (v ?? []).filter((p) => !p.endsWith("kit-truth.json"));

// ── polygon source: a file under the data root, or drawn on the map ───────────

type Zone = { polygon: string } | { polygon_geojson: GeoJSON.Polygon; name: string } | null;

function useZone(defaultFile: string | null, optional: boolean) {
  const ws = useWorkspace();
  const files = vectorsOf(ws.inputs?.vectors);
  const [mode, setMode] = useState<"file" | "draw" | "none">(defaultFile ? "file" : files.length ? "file" : "draw");
  const [file, setFile] = useState<string>(defaultFile ?? files[0] ?? "");
  const [name, setName] = useState("drawn polygon");
  const drawn = ws.drawn?.kind === "polygon" ? ws.drawn.coords : null;
  const zone: Zone =
    mode === "file" && file
      ? { polygon: file }
      : mode === "draw" && drawn
        ? { polygon_geojson: { type: "Polygon", coordinates: [closeRing(drawn)] }, name: name || "drawn polygon" }
        : null;
  const missing = !optional && zone === null;
  const ui = (
    <Section title="Area">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "file", label: "Polygon file" },
          { value: "draw", label: "Draw on map" },
          ...(optional ? [{ value: "none" as const, label: "Whole design" }] : []),
        ]}
      />
      {mode === "file" &&
        (files.length ? (
          <Select value={file} onChange={setFile} options={files.map((f) => ({ value: f, label: f }))} />
        ) : (
          <span className="text-[12.5px] text-muted">No vector files under the data root; draw one instead.</span>
        ))}
      {mode === "draw" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button variant={ws.drawing === "polygon" ? "primary" : "outline"} onClick={() => ws.startDrawing("polygon")} disabled={ws.drawing !== null}>
              {drawn ? "Redraw" : ws.drawing === "polygon" ? "Drawing…" : "Draw polygon"}
            </Button>
            {drawn && (
              <span className="num text-[12.5px] text-ink-2">
                ≈ {m2(ringArea(drawn), 0)} · {drawn.length} vertices
              </span>
            )}
          </div>
          {drawn && (
            <Field label="Zone name">
              <TextInput value={name} onChange={setName} />
            </Field>
          )}
        </div>
      )}
    </Section>
  );
  return { zone, missing, ui };
}

function latest(volumes: VolumeReport[] | undefined, kind: VolumeReport["kind"]): VolumeReport | undefined {
  return [...(volumes ?? [])].reverse().find((v) => v.kind === kind);
}

// ── Stockpile volume ──────────────────────────────────────────────────────────

export function VolumePanel({ blocked }: PanelProps) {
  const ws = useWorkspace();
  const { zone, missing, ui } = useZone(ws.kit?.stockpile ?? null, false);
  const [base, setBase] = useState<"plane" | "lowest-perimeter" | "surface">("plane");
  const [baseSurface, setBaseSurface] = useState(ws.inputs?.rasters[0] ?? "");
  const [surface, setSurface] = useState<"dsm" | "dtm">("dsm");
  const [allowVoids, setAllowVoids] = useState(false);
  const r = useStepRun("volume");
  const v = latest(ws.sidecar?.volumes, "stockpile");
  const baseArg = base === "surface" ? `surface:${baseSurface}` : base;
  return (
    <>
      <DemoTip>
        The kit&apos;s <span className="num">stockpile.geojson</span> rings the cone 1.5 m outside its toe; the
        answer is πr²h/3 = {num(KIT_TRUTH.stockpileVolume, 1)} m³. Try drawing your own ring too.
      </DemoTip>
      {ui}
      <Section title="Method">
        <Field
          label="Base"
          hint={
            base === "plane"
              ? "A plane fitted to the polygon's boundary heights (its RMS is reported)."
              : base === "lowest-perimeter"
                ? "A flat base at the lowest boundary height: conservative on slopes."
                : "A surveyed base surface (raster under the data root)."
          }
        >
          <Segmented
            value={base}
            onChange={setBase}
            options={[
              { value: "plane", label: "Fitted plane" },
              { value: "lowest-perimeter", label: "Lowest edge" },
              { value: "surface", label: "Surface" },
            ]}
          />
        </Field>
        {base === "surface" && (
          <Select value={baseSurface} onChange={setBaseSurface} options={(ws.inputs?.rasters ?? []).map((f) => ({ value: f, label: f }))} />
        )}
        <Field
          label="Measured surface"
          hint={surface === "dsm" ? "The DSM: a stockpile is not ground, so the ground filter takes it out of the DTM." : "The DTM reads low on a stockpile (≈10 % on the demo cone): the ground filter removes the pile."}
        >
          <Segmented value={surface} onChange={setSurface} options={[{ value: "dsm", label: "DSM" }, { value: "dtm", label: "DTM" }]} />
        </Field>
        <Toggle checked={allowVoids} onChange={setAllowVoids} label="Allow voids inside the polygon (reported)" />
      </Section>
      <RunBar
        label="Measure volume"
        busy={r.busy}
        outcome={r.outcome}
        disabled={blocked || missing}
        why={missing ? "Choose a polygon file or draw one." : undefined}
        onRun={() => r.run({ ...zone, base: baseArg, surface, allow_voids: allowVoids })}
      />
      {v && <VolumeResult report={v} truth={ws.kit && ws.jobId.startsWith("kit-") ? (ws.jobId === KIT_JOB_2 ? KIT_TRUTH.stockpileVolumeE2 : KIT_TRUTH.stockpileVolume) : null} />}
    </>
  );
}

function VolumeResult({ report, truth }: { report: VolumeReport; truth: number | null }) {
  return (
    <Section title="Result">
      {report.zones.map((z) => (
        <div key={z.name} className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Stat label={`${z.name} · above base`} value={m3(z.above_m3, 1)} big tone="data" sub={`below base ${m3(z.below_m3, 1)}`} />
            <Stat label="Area" value={m2(z.area_m2, 1)} sub={`voids ${pct(z.void_percent, 2)}`} tone={z.void_percent > 0 ? "warn" : undefined} />
          </div>
          {truth !== null && <TruthCheck label="vs the analytic cone" measured={z.above_m3} truth={truth} unit="m³" tolerance={TRUTH_TOLERANCE["stockpile-e1"]} />}
          <KV
            rows={[
              ["Base", z.base],
              ...(z.base_fit_rms_m !== null && z.base_fit_rms_m !== undefined ? ([["Base fit RMS", `${m(z.base_fit_rms_m, 3)} over ${z.boundary_samples} samples`]] as [string, string][]) : []),
            ]}
          />
        </div>
      ))}
      <Uncertainty report={report} />
    </Section>
  );
}

/** Rule 4: a volume carries the resolution, each surface's void %, and the method. */
function Uncertainty({ report }: { report: VolumeReport }) {
  return (
    <div className="rounded-md border border-line bg-panel-2 p-3 text-[12.5px]">
      <div className="mb-1 font-medium text-ink-2">Carried with the number</div>
      <KV
        rows={[
          ["Surfaces", report.surface],
          ["Resolution", m(report.res, 2)],
          ["Voids", Object.entries(report.surface_void_percent).map(([k, v]) => `${k} ${pct(v, 2)}`).join(" · ")],
          ["Method", report.method],
          ["Sign", report.sign_convention],
          ...(report.resampled ? ([["Resampled", report.resampled]] as [string, string][]) : []),
        ]}
      />
    </div>
  );
}

// ── Cut / fill ────────────────────────────────────────────────────────────────

export function CutfillPanel({ blocked }: PanelProps) {
  const ws = useWorkspace();
  const rasters = ws.inputs?.rasters ?? [];
  const [design, setDesign] = useState(ws.kit?.design ?? rasters[0] ?? "");
  const { zone, ui } = useZone(ws.kit?.pad ?? null, true);
  const [designVertical, setDesignVertical] = useState("");
  const [resample, setResample] = useState(false);
  const r = useStepRun("cutfill");
  const v = latest(ws.sidecar?.volumes, "cutfill");
  return (
    <>
      <DemoTip>
        <span className="num">design.tif</span> is a flat pad benched 0.25 m below the ground at its centre, so cut − fill
        over <span className="num">pad.geojson</span> is exactly {num(KIT_TRUTH.padNetCut, 0)} m³.
      </DemoTip>
      <Field label="Design surface" hint="A GeoTIFF under the data root, on the job grid (or resampled, which is recorded).">
        {rasters.length ? (
          <Select value={design} onChange={setDesign} options={rasters.map((f) => ({ value: f, label: f }))} />
        ) : (
          <span className="text-[12.5px] text-muted">No rasters under the data root.</span>
        )}
      </Field>
      {ui}
      <Field label="Design vertical datum" hint="Only if the design raster has none; must match the job's.">
        <TextInput value={designVertical} onChange={setDesignVertical} placeholder="from the raster" mono />
      </Field>
      <Toggle checked={resample} onChange={setResample} label="Resample the design onto the job grid if misaligned" />
      <RunBar
        label="Compute cut / fill"
        busy={r.busy}
        outcome={r.outcome}
        disabled={blocked || !design}
        why={!design ? "Choose a design surface." : undefined}
        onRun={() => r.run({ design, ...(zone ?? {}), design_vertical: designVertical || null, resample })}
      />
      {v && (
        <Section title="Result">
          {v.zones.map((z) => (
            <div key={z.name} className="flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Cut" value={m3(z.below_m3, 1)} tone="bad" sub={m2(z.area_below_m2, 0)} />
                <Stat label="Fill" value={m3(z.above_m3, 1)} tone="data" sub={m2(z.area_above_m2, 0)} />
                <Stat label="Net" value={m3(z.net_m3, 1)} sub={z.net_m3 < 0 ? "export" : "import"} />
              </div>
              {ws.kit && ws.jobId.startsWith("kit-") && z.name === "pad" && (
                <TruthCheck label="cut − fill vs the bench" measured={z.below_m3 - z.above_m3} truth={KIT_TRUTH.padNetCut} unit="m³" tolerance={TRUTH_TOLERANCE["pad-net-cut"]} />
              )}
            </div>
          ))}
          <Uncertainty report={v} />
        </Section>
      )}
    </>
  );
}

// ── Change ────────────────────────────────────────────────────────────────────

export function ChangePanel({ blocked }: PanelProps) {
  const ws = useWorkspace();
  const others = ws.jobs.filter((j) => j.job_id !== ws.jobId && j.steps_done.includes("surfaces"));
  const [against, setAgainst] = useState(others.find((j) => j.job_id === KIT_JOB_1)?.job_id ?? others[0]?.job_id ?? "");
  const [surface, setSurface] = useState<"dsm" | "dtm">("dsm");
  const inDemo = !!ws.kit && ws.jobId === KIT_JOB_2;
  const [lodMode, setLodMode] = useState<"value" | "accuracy">("value");
  const [lod, setLod] = useState<number | null>(inDemo ? 0 : 0.1);
  const [polygon, setPolygon] = useState(inDemo ? (ws.kit?.stockpile ?? "") : "");
  const r = useStepRun("change");
  const c = ws.sidecar?.change;
  const isKit1 = ws.jobId === KIT_JOB_1;
  const kit2 = ws.jobs.find((j) => j.job_id === KIT_JOB_2);
  return (
    <>
      {isKit1 && ws.kit?.epoch2 ? (
        <Banner tone="data" title="Change is measured on the later epoch">
          Process the kit&apos;s second epoch (the pile grew 1 m at its apex) as <span className="num">{KIT_JOB_2}</span>,
          then compare it against this job.
          <div className="mt-2">
            <Link href={`/jobs/${KIT_JOB_2}?demo=1`}>
              <Button variant="primary" size="sm">
                {kit2 ? `Open ${KIT_JOB_2} →` : `Start ${KIT_JOB_2} →`}
              </Button>
            </Link>
          </div>
        </Banner>
      ) : (
        <DemoTip>
          Inside the stockpile polygon with no level of detection, the gain is πr²·1 m/3 ={" "}
          {num(KIT_TRUTH.changeGain, 1)} m³. Then try a 0.1 m LoD (it trims the growth&apos;s shallow flanks) or the
          whole overlap (DSM noise under the tree crowns counts as change).
        </DemoTip>
      )}
      <Field label="Earlier epoch" hint="Same CRS and an aligned grid (grids snap to multiples of the resolution).">
        {others.length ? (
          <Select value={against} onChange={setAgainst} options={others.map((j) => ({ value: j.job_id, label: `${j.job_id}${j.crs ? ` · ${j.crs}` : ""}` }))} />
        ) : (
          <span className="text-[12.5px] text-muted">No other job with surfaces yet.</span>
        )}
      </Field>
      <Field label="Surface">
        <Segmented value={surface} onChange={setSurface} options={[{ value: "dsm", label: "DSM" }, { value: "dtm", label: "DTM" }]} />
      </Field>
      <Field label="Level of detection" hint={lodMode === "accuracy" ? "1.96 · √(σ₁² + σ₂²) from both jobs' NVA RMSE (run Accuracy in both first)." : "Changes smaller than this are not counted."}>
        <Segmented value={lodMode} onChange={setLodMode} options={[{ value: "value", label: "Fixed" }, { value: "accuracy", label: "From accuracy" }]} />
      </Field>
      {lodMode === "value" && <NumberInput value={lod} onChange={setLod} step={0.05} min={0} suffix="m" />}
      <Field label="Limit to polygon">
        <Select value={polygon} onChange={setPolygon} options={[{ value: "", label: "Whole overlap" }, ...vectorsOf(ws.inputs?.vectors).map((v) => ({ value: v, label: v }))]} />
      </Field>
      <RunBar
        label="Compute change"
        busy={r.busy}
        outcome={r.outcome}
        disabled={blocked || !against}
        why={!against ? "Needs an earlier job with surfaces." : undefined}
        onRun={() => r.run({ against, surface, lod: lodMode === "value" ? lod ?? 0 : null, lod_from_accuracy: lodMode === "accuracy", polygon: polygon || null })}
      />
      {c && (
        <Section title={`Against ${c.against_job}`}>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Gain" value={m3(c.gain_m3, 1)} tone="bad" sub={m2(c.gain_area_m2, 0)} />
            <Stat label="Loss" value={m3(c.loss_m3, 1)} tone="data" sub={m2(c.loss_area_m2, 0)} />
            <Stat label="Net" value={m3(c.net_m3, 1)} sub={`${m2(c.compared_area_m2, 0)} compared`} />
          </div>
          {ws.kit && ws.jobId === KIT_JOB_2 && c.lod_m === 0 && c.area !== "whole overlap of the two epochs" && (
            <TruthCheck label="gain vs the grown cone" measured={c.gain_m3} truth={KIT_TRUTH.changeGain} unit="m³" tolerance={TRUTH_TOLERANCE["change-gain"]} />
          )}
          <KV
            rows={[
              ["LoD", `${m(c.lod_m, 3)} · ${c.lod_rule}`],
              ["Area", c.area ?? "whole overlap"],
              ["Voids", pct(c.void_percent, 2)],
              ["Epochs pinned", <span key="p" className="num text-[12px]">{c.against_sidecar_sha256.slice(0, 10)}… / {c.this_sidecar_sha256.slice(0, 10)}…</span>],
            ]}
          />
        </Section>
      )}
    </>
  );
}

// ── Accuracy ──────────────────────────────────────────────────────────────────

export function AccuracyPanel({ blocked }: PanelProps) {
  const ws = useWorkspace();
  const tables = ws.inputs?.tables ?? [];
  const [checks, setChecks] = useState(ws.kit?.checks ?? tables[0] ?? "");
  const [crs, setCrs] = useState(ws.sidecar?.crs?.definition ?? "");
  const [cols, setCols] = useState("id,x,y,z");
  const [cpRmse, setCpRmse] = useState<number | null>(null);
  const [classCm, setClassCm] = useState<number | null>(10);
  const [surface, setSurface] = useState<"dtm" | "dsm">("dtm");
  const r = useStepRun("accuracy");
  const a = ws.sidecar?.accuracy;
  const colList = cols.split(",").map((c) => c.trim());
  return (
    <>
      <DemoTip>
        40 check points on the true ground: 30 in the open (NVA), 10 under tree crowns (VVA). The points carry 2 cm of
        noise; the DTM averages neighbours, so expect an NVA RMSE well under that.
      </DemoTip>
      <Field label="Check points (CSV)">
        {tables.length ? <Select value={checks} onChange={setChecks} options={tables.map((t) => ({ value: t, label: t }))} /> : <span className="text-[12.5px] text-muted">No CSVs under the data root.</span>}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Their CRS" hint="transformed through the job's operation">
          <TextInput value={crs} onChange={setCrs} mono />
        </Field>
        <Field label="Columns" hint="id, x, y, z" error={colList.length !== 4 ? "exactly four names" : null}>
          <TextInput value={cols} onChange={setCols} mono />
        </Field>
        <Field label="Check point RMSE" hint="their own survey accuracy">
          <NumberInput value={cpRmse} onChange={setCpRmse} step={0.005} min={0} suffix="m" placeholder="unknown" />
        </Field>
        <Field label="Target class" hint="ASPRS NVA pass/fail">
          <NumberInput value={classCm} onChange={setClassCm} step={1} min={1} suffix="cm" placeholder="report only" />
        </Field>
      </div>
      <Field label="Surface">
        <Segmented value={surface} onChange={setSurface} options={[{ value: "dtm", label: "DTM" }, { value: "dsm", label: "DSM" }]} />
      </Field>
      <RunBar
        label="Assess accuracy"
        busy={r.busy}
        outcome={r.outcome}
        disabled={blocked || !checks || !crs || colList.length !== 4}
        why={!checks ? "Choose a check point CSV." : colList.length !== 4 ? "Columns: exactly four names." : undefined}
        onRun={() => r.run({ checks, crs, cols: colList, checkpoint_rmse: cpRmse, class_cm: classCm, surface })}
      />
      {a && (
        <>
          <div className="rounded-lg border border-data/40 bg-data-soft px-3 py-2.5 text-[13px] text-ink">{a.statement}</div>
          <Section title={a.standard}>
            <div className="flex flex-col gap-2">
              {a.groups.map((g) => (
                <GroupCard key={g.group} g={g} target={a.target_class_cm ?? null} />
              ))}
            </div>
          </Section>
          <Section title="Residuals (surface − check)">
            <ResidualHistogram residuals={a.residuals} />
          </Section>
          {(a.notes?.length ?? 0) > 0 && (
            <ul className="list-disc pl-5 text-[12.5px] text-muted">
              {a.notes?.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function GroupCard({ g, target }: { g: AccuracyGroup; target: number | null }) {
  const pass = g.pass_fail_applies && target !== null && g.rmse_m !== null && g.rmse_m !== undefined ? g.rmse_m * 100 <= target : null;
  return (
    <div className="rounded-md border border-line bg-panel-2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">{g.group === "NVA" ? "NVA · non-vegetated" : "VVA · vegetated"}</span>
        <div className="flex gap-1.5">
          {!g.meets_minimum_count && <Pill tone="warn">n &lt; 30</Pill>}
          {pass !== null ? <Pill tone={pass ? "ok" : "bad"}>{pass ? `passes ${target} cm` : `fails ${target} cm`}</Pill> : <Pill>reported as found</Pill>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="RMSE" value={cm(g.rmse_m)} sub={g.rmse_data_m !== g.rmse_m ? `data ${cm(g.rmse_data_m)}` : "data only"} tone="data" />
        <Stat label="Mean" value={cm(g.mean_m)} sub={`σ ${cm(g.std_m)}`} />
        <Stat label="Checks" value={count(g.n)} sub={g.excluded ? `${g.excluded} excluded` : `max |e| ${cm(g.max_abs_m)}`} />
      </div>
    </div>
  );
}

function ResidualHistogram({ residuals }: { residuals: CheckResidual[] }) {
  const used = residuals.filter((r) => r.residual !== null && r.residual !== undefined && !r.excluded);
  const excluded = residuals.length - used.length;
  if (used.length === 0) return <span className="text-muted">No residuals.</span>;
  const vals = used.map((r) => r.residual! * 100);
  const lim = Math.max(2, Math.ceil(Math.max(...vals.map(Math.abs))));
  const bins = 16;
  const w = (2 * lim) / bins;
  const counts = { NVA: Array(bins).fill(0) as number[], VVA: Array(bins).fill(0) as number[] };
  used.forEach((r, i) => {
    const b = Math.min(bins - 1, Math.max(0, Math.floor((vals[i] + lim) / w)));
    counts[r.group][b]++;
  });
  const max = Math.max(...counts.NVA.map((n, i) => n + counts.VVA[i]), 1);
  return (
    <div>
      <svg viewBox={`0 0 ${bins * 20} 90`} className="h-28 w-full" role="img" aria-label="Residual histogram">
        <line x1={(bins * 20) / 2} x2={(bins * 20) / 2} y1={0} y2={80} stroke="var(--line-strong)" strokeDasharray="2 2" />
        {counts.NVA.map((n, i) => {
          const v = counts.VVA[i];
          const hn = (n / max) * 76;
          const hv = (v / max) * 76;
          return (
            <g key={i}>
              <rect x={i * 20 + 2} y={80 - hn} width={16} height={hn} fill="var(--data)" rx={1.5} />
              <rect x={i * 20 + 2} y={80 - hn - hv} width={16} height={hv} fill="var(--ok)" opacity={0.75} rx={1.5} />
            </g>
          );
        })}
      </svg>
      <div className="num flex justify-between text-[11px] text-muted">
        <span>−{lim} cm</span>
        <span className="flex gap-3">
          <span className="text-data">■ NVA</span>
          <span className="text-ok">■ VVA</span>
        </span>
        <span>+{lim} cm</span>
      </div>
      {excluded > 0 && <div className="mt-1 text-[12px] text-warn">{excluded} check point(s) excluded (outside coverage or on a void), listed in the report.</div>}
    </div>
  );
}

// ── Profile ───────────────────────────────────────────────────────────────────

export function ProfilePanel({ blocked }: PanelProps) {
  const ws = useWorkspace();
  const [step, setStep] = useState<number | null>(0.5);
  const r = useStepRun("profile");
  const drawn = ws.drawn?.kind === "line" ? ws.drawn.coords : null;
  const p = ws.sidecar?.profiles?.[ws.sidecar.profiles.length - 1];
  const svg = ws.sidecar?.products?.profile_svg;
  return (
    <>
      <DemoTip>Draw across the stockpile: the section shows its 4 m apex above the tilted ground.</DemoTip>
      <div className="flex items-center gap-2">
        <Button variant={ws.drawing === "line" ? "primary" : "outline"} onClick={() => ws.startDrawing("line")} disabled={ws.drawing !== null}>
          {drawn ? "Redraw line" : ws.drawing === "line" ? "Drawing…" : "Draw a line on the map"}
        </Button>
        {drawn && <span className="num text-[12.5px] text-ink-2">≈ {m(lineLength(drawn), 1)}</span>}
      </div>
      <Field label="Sample every">
        <NumberInput value={step} onChange={setStep} step={0.25} min={0.05} suffix="m" />
      </Field>
      <RunBar
        label="Cut the profile"
        busy={r.busy}
        outcome={r.outcome}
        disabled={blocked || !drawn}
        why={!drawn ? "Draw a line first." : undefined}
        onRun={() => r.run({ line: { type: "LineString", coordinates: drawn }, step: step ?? 0.5 })}
      />
      {p && svg && (
        <Section title={`${num(p.length_m, 1)} m · ${count(p.samples)} samples`} aside={<a className="text-[12.5px] text-data hover:underline" href={productUrl(ws.jobId, "profile")}>CSV ↓</a>}>
          {/* eslint-disable-next-line @next/next/no-img-element -- an SVG product from the API, not a static asset */}
          <img src={`${productUrl(ws.jobId, "profile_svg")}?v=${svg.sha256.slice(0, 12)}`} alt={`Profile along ${p.line}`} className={cx("w-full rounded-md border border-line bg-white")} />
          <span className="text-[12px] text-muted">Surfaces: {p.surfaces.map((s) => s.toUpperCase()).join(", ")} · voids break the line</span>
        </Section>
      )}
    </>
  );
}
