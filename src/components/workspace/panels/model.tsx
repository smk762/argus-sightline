"use client";

import { useState } from "react";
import { count, m, num, pct } from "@/lib/format";
import { Banner, Field, KV, NumberInput, Section, Segmented, Stat, Toggle } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/context";
import { DemoTip, RunBar, useStepRun, type PanelProps } from "@/components/workspace/panels/StepPanel";

// ── Ground ────────────────────────────────────────────────────────────────────

export function GroundPanel({ blocked }: PanelProps) {
  const ws = useWorkspace();
  const [method, setMethod] = useState<"smrf" | "csf">("smrf");
  const [keep, setKeep] = useState(false);
  const r = useStepRun("ground");
  const g = ws.sidecar?.ground;
  return (
    <>
      <DemoTip>Open the 3D view and colour by class afterwards: the cone, the building and the trees are not ground.</DemoTip>
      <Field label="Filter" hint={method === "smrf" ? "Simple Morphological Filter: robust on open and urban terrain." : "Cloth Simulation Filter: drapes a cloth under the inverted cloud; good on steep ground."}>
        <Segmented value={method} onChange={setMethod} options={[{ value: "smrf", label: "SMRF" }, { value: "csf", label: "CSF" }]} />
      </Field>
      <Toggle checked={keep} onChange={setKeep} label="Keep the file's existing classes (don't reset them first)" />
      <RunBar label={g ? "Re-classify ground" : "Classify ground"} busy={r.busy} outcome={r.outcome} disabled={blocked} onRun={() => r.run({ method, keep_classes: keep })} />
      {g && (
        <>
          <Section title="Result">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Ground" value={pct(g.ground_percent, 1)} sub={`${count(g.ground_points)} pts`} big tone="data" />
              <Stat label="Ground spacing" value={m(g.ground_spacing, 2)} sub={`${num(g.ground_density, 1)} pts/m²`} />
              <Stat label="Noise (class 7)" value={count(g.noise_points)} />
              <Stat label="Tiles" value={g.tiles} sub={`${num(g.tile_size, 0)} m + ${num(g.tile_buffer, 0)} m buffer`} />
            </div>
          </Section>
          <Section title="Parameters, as run">
            <KV
              rows={[
                ["Method", g.method.toUpperCase()],
                ...Object.entries(g.params).map(([k, v]) => [k, <span key={k} className="num">{String(v)}</span>] as [string, React.ReactNode]),
                ["Classes reset", g.reset_classes ? "yes" : "no"],
                ["Returns normalised", g.normalised_returns ? "yes (photogrammetry: 1 of 1)" : "no"],
              ]}
            />
          </Section>
        </>
      )}
    </>
  );
}

// ── Surfaces ──────────────────────────────────────────────────────────────────

export function SurfacesPanel({ blocked }: PanelProps) {
  const ws = useWorkspace();
  const [res, setRes] = useState<number | null>(0.5);
  const [dtm, setDtm] = useState(true);
  const [dsm, setDsm] = useState(true);
  const [chm, setChm] = useState(true);
  const [dsmMethod, setDsmMethod] = useState<"idw" | "max">("idw");
  const [fill, setFill] = useState<number | null>(null);
  const r = useStepRun("surfaces");
  const s = ws.sidecar?.surfaces;
  const spacing = ws.sidecar?.ground?.ground_spacing;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Resolution" hint={spacing ? `ground spacing is ${num(spacing, 2)} m` : undefined}>
          <NumberInput value={res} onChange={setRes} step={0.25} min={0.05} suffix="m" />
        </Field>
        <Field label="Fill voids up to" hint="re-masked to coverage">
          <NumberInput value={fill} onChange={setFill} step={1} min={1} suffix="cells" placeholder="off" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4">
        <Toggle checked={dtm} onChange={setDtm} label="DTM" />
        <Toggle checked={dsm} onChange={setDsm} label="DSM" />
        <Toggle checked={chm} onChange={setChm} label="CHM" />
      </div>
      {dsm && (
        <Field label="DSM method" hint={dsmMethod === "idw" ? "IDW: unbiased on slopes (stockpiles)." : "Binned max: crisp roofs and canopy, reads high on slopes by ≈ slope × res/2."}>
          <Segmented value={dsmMethod} onChange={setDsmMethod} options={[{ value: "idw", label: "IDW" }, { value: "max", label: "Max" }]} />
        </Field>
      )}
      <RunBar
        label={s ? "Rebuild surfaces" : "Build surfaces"}
        busy={r.busy}
        outcome={r.outcome}
        disabled={blocked || !(dtm || dsm || chm)}
        why={!(dtm || dsm || chm) ? "Choose at least one surface." : undefined}
        onRun={() => r.run({ res: res ?? 0.5, dtm, dsm, chm, dsm_method: dsmMethod, fill_voids: fill })}
      />
      {s && (
        <>
          {s.resolution_warning && <Banner tone="warn">{s.resolution_warning}</Banner>}
          <Section title={`Grid · ${num(s.grid.res, 2)} m · ${s.grid.width} × ${s.grid.height}`}>
            <div className="flex flex-col gap-2">
              {Object.entries(s.surfaces ?? {}).map(([k, v]) => (
                <div key={k} className="rounded-md border border-line bg-panel-2 p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-semibold">{k.toUpperCase()}</span>
                    <span className={`num text-[12.5px] ${v.void_percent > 2 ? "text-warn" : "text-muted"}`}>
                      voids {pct(v.void_percent, 2)}
                      {v.void_percent_after_fill !== null && v.void_percent_after_fill !== undefined && ` → ${pct(v.void_percent_after_fill, 2)}`}
                    </span>
                  </div>
                  <div className="text-[12px] text-muted">{v.method} · {v.points_used}</div>
                  <div className="num mt-1 text-[12px] text-ink-2">
                    {num(v.stats.minimum, 2)} … {num(v.stats.maximum, 2)} m · mean {num(v.stats.mean, 2)}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </>
  );
}

// ── Contours ──────────────────────────────────────────────────────────────────

export function ContoursPanel({ blocked }: PanelProps) {
  const ws = useWorkspace();
  const [interval, setInterval] = useState<number | null>(0.5);
  const [index, setIndex] = useState<number | null>(5);
  const r = useStepRun("contours");
  const c = ws.sidecar?.contours;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Interval">
          <NumberInput value={interval} onChange={setInterval} step={0.25} min={0.05} suffix="m" />
        </Field>
        <Field label="Index every" hint="bold line">
          <NumberInput value={index} onChange={setIndex} step={1} min={1} suffix="th" placeholder="none" />
        </Field>
      </div>
      <RunBar label={c ? "Regenerate contours" : "Generate contours"} busy={r.busy} outcome={r.outcome} disabled={blocked} onRun={() => r.run({ interval: interval ?? 0.5, index })} />
      {c && (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Lines" value={count(c.features)} sub={`every ${num(c.interval, 2)} m${c.index_every ? `, index ${c.index_every}` : ""}`} big />
          <Stat label="Range" value={`${num(c.min_elev, 1)} … ${num(c.max_elev, 1)}`} sub={`m · from ${c.source.toUpperCase()}`} />
        </div>
      )}
    </>
  );
}
