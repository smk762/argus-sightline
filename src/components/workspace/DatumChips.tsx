"use client";

import type { CrsRecord } from "@/lib/generated/survey";
import { describeDatum } from "@/lib/datum";
import { Pill } from "@/components/ui";

/** Rule 1, always on screen: horizontal CRS, vertical datum (or the lack of one), geoid, epoch, source type. */
export function DatumChips({ crs, sourceType }: { crs: CrsRecord | null | undefined; sourceType?: string }) {
  const d = describeDatum(crs);
  if (!d) return <Pill>no CRS yet</Pill>;
  const vTone = d.status === "gravity" ? "ok" : d.status === "ellipsoidal" ? "warn" : "bad";
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Pill tone="data" title={`${d.horizontal} · units ${d.units}`}>
        <span className="text-muted">H</span>
        <span className="max-w-[16rem] truncate">{d.horizontal}</span>
        {d.horizontalCode && <span className="num opacity-70">{d.horizontalCode}</span>}
      </Pill>
      <Pill tone={vTone} title={d.detail}>
        <span className="text-muted">V</span>
        {d.status === "assumed" && <strong>ASSUMED</strong>}
        <span className="max-w-[12rem] truncate">{d.vertical}</span>
        {d.verticalCode && <span className="num opacity-70">{d.verticalCode}</span>}
      </Pill>
      {d.geoid && (
        <Pill title={`Geoid grid applied: ${d.geoid}`}>
          <span className="max-w-[10rem] truncate">{prettyGeoid(d.geoid)}</span>
        </Pill>
      )}
      {d.epoch !== null && <Pill title="Coordinate epoch">epoch {d.epoch}</Pill>}
      {sourceType && sourceType !== "unknown" && <Pill>{sourceType}</Pill>}
    </div>
  );
}

function prettyGeoid(grid: string): string {
  if (/AUSGeoid2020/i.test(grid)) return "AUSGeoid2020";
  if (/AUSGeoid09/i.test(grid)) return "AUSGeoid09";
  if (/AGQG/i.test(grid)) return "AGQG2017";
  if (/GEOID18/i.test(grid)) return "GEOID18";
  return grid.replace(/\.(tif|gtx)$/i, "");
}
