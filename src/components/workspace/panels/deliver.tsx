"use client";

import { bytes, seconds } from "@/lib/format";
import { productUrl } from "@/lib/surveyApi";
import { Button, Section } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/context";
import { DemoTip, RunBar, useStepRun, type PanelProps } from "@/components/workspace/panels/StepPanel";

export function ReportPanel({ blocked }: PanelProps) {
  const ws = useWorkspace();
  const r = useStepRun("report");
  const s = ws.sidecar;
  const products = Object.values(s?.products ?? {}).sort((a, b) => a.kind.localeCompare(b.kind));
  const timings = Object.entries(s?.timings ?? {});
  const total = timings.reduce((t, [, v]) => t + v, 0);
  return (
    <>
      <DemoTip>Regenerate the report after the measure steps: it embeds every result, datum and command so far.</DemoTip>
      <RunBar
        label={s?.products?.report ? "Regenerate report" : "Write report"}
        busy={r.busy}
        outcome={r.outcome}
        disabled={blocked}
        onRun={() => r.run({})}
        secondary={
          s?.products?.report && (
            <a href={productUrl(ws.jobId, "report")} target="_blank" rel="noopener">
              <Button variant="outline" size="lg">
                Open ↗
              </Button>
            </a>
          )
        }
      />
      {products.length > 0 && (
        <Section title={`Products · ${products.length}`} aside={<span className="text-[12px] text-muted">SHA256-pinned</span>}>
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-panel-2">
            {products.map((p) => (
              <li key={p.kind}>
                <a href={productUrl(ws.jobId, p.kind)} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px] hover:bg-raised" title={p.sha256}>
                  <span className="min-w-0">
                    <span className="num block truncate text-ink">{p.path}</span>
                    <span className="block truncate text-muted">{p.description || p.kind}</span>
                  </span>
                  <span className="num shrink-0 text-muted">{bytes(p.size)} ↓</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {timings.length > 0 && (
        <Section title={`Timings · ${seconds(total)}`}>
          <ul className="flex flex-col gap-1.5 text-[12.5px]">
            {timings.map(([k, v]) => (
              <li key={k} className="grid grid-cols-[6rem_1fr_4rem] items-center gap-2">
                <span className="text-ink-2">{k}</span>
                <div className="h-1.5 rounded-full bg-raised">
                  <div className="h-full rounded-full bg-data" style={{ width: `${Math.max(2, (v / total) * 100)}%` }} />
                </div>
                <span className="num text-right text-muted">{seconds(v)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {s && (
        <Section title="Provenance">
          <p className="text-[12.5px] text-muted">
            {s.commands?.length ?? 0} commands recorded with PDAL {s.tools?.pdal}, GDAL {s.tools?.gdal}, PROJ {s.tools?.proj} · argus-survey{" "}
            {s.package_version} · schema v{s.schema_version}. Open the console&apos;s Provenance tab for every argv and pipeline.
          </p>
        </Section>
      )}
    </>
  );
}
