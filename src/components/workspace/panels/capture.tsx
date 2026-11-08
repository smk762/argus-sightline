"use client";

import { useState } from "react";
import { KIT_JOB_2, KIT_TRUTH } from "@/lib/demoKit";
import { VERTICAL_PRESETS, WA_PRESETS } from "@/lib/datum";
import { bytes, count, m2, num, pct } from "@/lib/format";
import { Banner, cx, Field, KV, NumberInput, Pill, Section, Select, Stat, TextInput, Toggle } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/context";
import { DemoTip, RunBar, useStepRun, type PanelProps } from "@/components/workspace/panels/StepPanel";

// ── Ingest ────────────────────────────────────────────────────────────────────

export function IngestPanel({ blocked }: PanelProps) {
  const ws = useWorkspace();
  const kitInput = ws.kit ? (ws.jobId === KIT_JOB_2 ? ws.kit.epoch2 : ws.kit.epoch1) : null;
  const points = ws.inputs?.points ?? [];
  const vectors = (ws.inputs?.vectors ?? []).filter((v) => !v.endsWith("kit-truth.json"));
  const [selected, setSelected] = useState<string[]>(() => (kitInput ? [kitInput] : []));
  const [target, setTarget] = useState<string>(ws.kit ? KIT_TRUTH.crs : "");
  const [source, setSource] = useState("");
  const [assume, setAssume] = useState("");
  const [operation, setOperation] = useState("");
  const [crop, setCrop] = useState("");
  const [res, setRes] = useState<number | null>(0.5);
  const [interval, setInterval] = useState<number | null>(0.5);
  const [advanced, setAdvanced] = useState(false);
  const exists = ws.sidecar !== null;
  const [force, setForce] = useState(false);
  const ingest = useStepRun("ingest");
  const pipeline = useStepRun("run");

  const body = {
    inputs: selected,
    t_srs: target || null,
    s_srs: source || null,
    assume_vertical: assume || null,
    operation: operation || null,
    crop: crop || null,
  };
  const why = selected.length === 0 ? "Choose at least one point cloud." : exists && !force ? "Re-ingesting replaces this job's cloud: tick Replace." : undefined;
  const rec = ws.sidecar?.ingest;

  return (
    <>
      <DemoTip>
        The kit&apos;s {ws.jobId === KIT_JOB_2 ? "second" : "first"} epoch is selected, declared as MGA2020 zone 50 + AHD.
        <strong> Run the core pipeline</strong> to go from points to a report in one go (about a minute), or ingest and
        walk each step.
      </DemoTip>

      {!rec && (
        <>
          <Section title="Point clouds" aside={<span className="text-[12px] text-muted">under SURVEY_DATA_DIR</span>}>
            {points.length === 0 ? (
              <Banner tone="data">No .las/.laz files under the server&apos;s data root yet.</Banner>
            ) : (
              <ul className="flex max-h-44 flex-col gap-1 overflow-auto rounded-md border border-line bg-panel-2 p-1.5">
                {points.map((p) => {
                  const on = selected.includes(p);
                  return (
                    <li key={p}>
                      <label className={cx("flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[13px]", on ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-raised")}>
                        <input type="checkbox" className="accent-[var(--accent)]" checked={on} onChange={() => setSelected(on ? selected.filter((s) => s !== p) : [...selected, p])} />
                        <span className="num truncate">{p}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Datums">
            <Field label="Working CRS" hint="The job's CRS. A 2D target keeps the source heights explicitly; geographic and Web Mercator are refused.">
              <TextInput value={target} onChange={setTarget} placeholder="as in the file" list="crs-presets" mono />
              <datalist id="crs-presets">
                {WA_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </datalist>
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {WA_PRESETS.slice(0, 3).map((p) => (
                <button key={p.value} type="button" onClick={() => setTarget(p.value)} className={cx("rounded-full border px-2 py-0.5 text-[11.5px]", target === p.value ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink")}>
                  {p.label}
                </button>
              ))}
            </div>
            <Field
              label="Assume vertical datum"
              hint={assume ? <span className="text-bad">Recorded as an assumption and shown in red in the report.</span> : "Only if the file has no vertical CRS and you know the heights' datum."}
            >
              <Select value={assume} onChange={setAssume} options={[{ value: "", label: "No assumption (use the file's)" }, ...VERTICAL_PRESETS]} />
            </Field>
            <button type="button" className="self-start text-[12.5px] text-data hover:underline" onClick={() => setAdvanced((a) => !a)}>
              {advanced ? "− fewer options" : "+ source CRS override, pinned operation, crop"}
            </button>
            {advanced && (
              <div className="flex flex-col gap-3">
                <Field label="Source CRS override" hint="When the file's CRS is missing or wrong.">
                  <TextInput value={source} onChange={setSource} placeholder="e.g. EPSG:28350+5711" mono />
                </Field>
                <Field label="Pin a transformation" hint='GDA94 → GDA2020 has several valid operations; legacy WA control often warrants "GDA94 to GDA2020 (2)" (conformal + distortion grid).'>
                  <TextInput value={operation} onChange={setOperation} placeholder="PROJ's ranked choice" />
                </Field>
                <Field label="Crop to polygon">
                  <Select value={crop} onChange={setCrop} options={[{ value: "", label: "No crop" }, ...vectors.map((v) => ({ value: v, label: v }))]} />
                </Field>
              </div>
            )}
          </Section>

          <Section title="Core pipeline settings">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Surface resolution">
                <NumberInput value={res} onChange={setRes} step={0.25} min={0.05} suffix="m" />
              </Field>
              <Field label="Contour interval">
                <NumberInput value={interval} onChange={setInterval} step={0.25} min={0.05} suffix="m" />
              </Field>
            </div>
          </Section>
        </>
      )}

      {exists && (
        <Toggle checked={force} onChange={setForce} label={<span>Replace this job&apos;s cloud (re-ingest{rec ? "; select inputs again below" : ""})</span>} />
      )}
      {exists && force && rec && <ReingestPicker points={points} selected={selected} setSelected={setSelected} />}

      {(!rec || force) && (
        <RunBar
          label="Run core pipeline"
          busy={pipeline.busy}
          outcome={pipeline.outcome ?? ingest.outcome}
          disabled={blocked || !!why}
          why={why}
          onRun={() => pipeline.run({ ...body, force, res: res ?? 0.5, interval: interval ?? 0.5 })}
          secondary={
            <button
              type="button"
              disabled={!!why || ws.running !== null || !ws.canWrite}
              onClick={() => ingest.run({ ...body, force })}
              className="h-10 rounded-md border border-line bg-panel-2 px-3 text-[13px] font-medium text-ink hover:bg-raised disabled:opacity-45"
            >
              {ingest.busy ? "Ingesting…" : "Ingest only"}
            </button>
          }
        />
      )}

      {rec && <IngestResult />}
    </>
  );
}

function ReingestPicker({ points, selected, setSelected }: { points: string[]; selected: string[]; setSelected: (s: string[]) => void }) {
  return (
    <ul className="flex max-h-36 flex-col gap-1 overflow-auto rounded-md border border-line bg-panel-2 p-1.5">
      {points.map((p) => (
        <li key={p}>
          <label className="flex items-center gap-2 px-2 py-1 text-[13px]">
            <input type="checkbox" className="accent-[var(--accent)]" checked={selected.includes(p)} onChange={() => setSelected(selected.includes(p) ? selected.filter((s) => s !== p) : [...selected, p])} />
            <span className="num truncate">{p}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function IngestResult() {
  const ws = useWorkspace();
  const s = ws.sidecar!;
  const rec = s.ingest!;
  const t = rec.transform;
  return (
    <>
      <Section title="Result">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Points" value={count(rec.output_count)} sub={rec.inputs_count > 1 ? `from ${rec.inputs_count} files` : rec.source_type} big />
          <Stat label="Source type" value={rec.source_type} sub={`scale ${rec.scale} m`} />
        </div>
        {rec.cropped && <Banner tone="data">Cropped: {rec.crop}</Banner>}
      </Section>
      <Section title="Datum resolution">
        <KV
          rows={[
            ["Source CRS", <span key="s">{rec.source_crs.name} <span className="text-muted">({rec.source_crs.source})</span></span>],
            ["Working CRS", s.crs?.name ?? "—"],
            ["Definition", <span key="d" className="num text-[12px]">{s.crs?.definition}</span>],
            ...(s.crs?.vertical_assumed ? ([["Assumed", <span key="a" className="text-bad">{s.crs.vertical_assumed}</span>]] as [string, React.ReactNode][]) : []),
          ]}
        />
        {t ? (
          <div className="rounded-md border border-line bg-panel-2 p-3 text-[12.5px]">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-medium">{t.name}</span>
              <Pill tone={t.chosen_by === "user" ? "accent" : "neutral"}>{t.chosen_by === "user" ? "pinned" : "PROJ's first with grids"}</Pill>
            </div>
            <div className="text-muted">
              accuracy {t.accuracy_m !== null && t.accuracy_m !== undefined ? `${t.accuracy_m} m` : "unknown"}
              {t.grids?.length ? ` · grids: ${t.grids.join(", ")}` : " · no grids"}
            </div>
            {(t.candidates?.length ?? 0) > 1 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-data">{t.candidates!.length} candidate operations</summary>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {t.candidates!.map((c) => (
                    <li key={c.name} className={cx("flex justify-between gap-2", c.name === t.name ? "text-ink" : "text-muted")}>
                      <span className="truncate">{c.name === t.name ? "● " : ""}{c.name}</span>
                      <span className="num shrink-0">{c.missing_grids?.length ? "grid missing" : c.accuracy_m !== null && c.accuracy_m !== undefined ? `${c.accuracy_m} m` : "—"}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ) : (
          <span className="text-[12.5px] text-muted">No transformation: the source CRS is the working CRS.</span>
        )}
      </Section>
      <Section title="Inputs, pinned">
        <ul className="flex flex-col gap-1 text-[12.5px]">
          {s.inputs?.map((i) => (
            <li key={i.path} className="flex justify-between gap-2">
              <span className="num truncate">{i.path.split("/").pop()}</span>
              <span className="num shrink-0 text-muted" title={i.sha256}>
                {bytes(i.size)} · {i.sha256.slice(0, 10)}…
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

// ── QA ────────────────────────────────────────────────────────────────────────

export function QaPanel({ blocked }: PanelProps) {
  const ws = useWorkspace();
  const [densityRes, setDensityRes] = useState<number | null>(1);
  const [minDensity, setMinDensity] = useState<number | null>(null);
  const r = useStepRun("qa");
  const qa = ws.sidecar?.qa;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Density cell">
          <NumberInput value={densityRes} onChange={setDensityRes} step={0.5} min={0.1} suffix="m" />
        </Field>
        <Field label="Gap threshold" hint="default: 25 % of median">
          <NumberInput value={minDensity} onChange={setMinDensity} step={1} min={0} suffix="/m²" placeholder="auto" />
        </Field>
      </div>
      <RunBar label={qa ? "Re-run quality check" : "Run quality check"} busy={r.busy} outcome={r.outcome} disabled={blocked} onRun={() => r.run({ density_res: densityRes ?? 1, min_density: minDensity })} />
      {qa && (
        <>
          <Section title="Coverage and density">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Median density" value={`${num(qa.density.p50, 1)}`} sub="pts/m²" big tone="data" />
              <Stat label="Coverage" value={m2(qa.coverage_area_m2, 0)} sub={`hex edge ${num(qa.coverage_hex_edge, 2)} m`} />
              <Stat label="Gaps" value={pct(qa.gaps.percent_of_coverage, 2)} sub={`< ${num(qa.gaps.threshold, 1)} pts/m²`} tone={qa.gaps.percent_of_coverage > 5 ? "warn" : undefined} />
              <Stat label="Outliers" value={count(qa.outliers.count)} sub={`${pct(qa.outliers.percent, 3)} · ${qa.outliers.method}`} />
            </div>
            <DensityBar p5={qa.density.p5} p50={qa.density.p50} p95={qa.density.p95} />
          </Section>
          <Section title="Classes in the file">
            <ClassBars rows={qa.classes.map((c) => ({ label: `${c.code} ${c.name}`, pct: c.percent, n: c.count }))} />
          </Section>
          {qa.returns.length > 0 && (
            <Section title="Return numbers">
              <ClassBars rows={qa.returns.map((v) => ({ label: `return ${v.value}`, pct: v.percent, n: v.count }))} />
            </Section>
          )}
        </>
      )}
    </>
  );
}

function DensityBar({ p5, p50, p95 }: { p5: number | null; p50: number; p95: number }) {
  return (
    <div className="flex items-center gap-3 text-[12px] text-muted">
      <span className="num">p5 {p5 !== null ? num(p5, 1) : "—"}</span>
      <div className="relative h-1.5 flex-1 rounded-full bg-raised">
        <div className="absolute inset-y-0 rounded-full bg-data/50" style={{ left: `${p5 !== null ? (p5 / p95) * 100 : 0}%`, right: 0 }} />
        <div className="absolute -top-1 h-3.5 w-0.5 bg-data" style={{ left: `${(p50 / p95) * 100}%` }} />
      </div>
      <span className="num">p95 {num(p95, 1)}</span>
    </div>
  );
}

export function ClassBars({ rows }: { rows: { label: string; pct: number; n: number }[] }) {
  return (
    <ul className="flex flex-col gap-1.5 text-[12.5px]">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[8rem_1fr_4.5rem] items-center gap-2">
          <span className="truncate text-ink-2">{r.label}</span>
          <div className="h-1.5 rounded-full bg-raised">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(1, r.pct)}%` }} />
          </div>
          <span className="num text-right text-muted">{pct(r.pct, 1)}</span>
        </li>
      ))}
    </ul>
  );
}
