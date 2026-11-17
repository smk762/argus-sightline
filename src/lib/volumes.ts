/** Reading the volume reports in a job's sidecar. */

import type { VolumeReport } from "@/lib/generated/survey";

/** The most recent volume report of `kind`, or `undefined` when the job has none. */
export function latestVolume(volumes: readonly VolumeReport[] | null | undefined, kind: VolumeReport["kind"]): VolumeReport | undefined {
  return [...(volumes ?? [])].reverse().find((v) => v.kind === kind);
}

/**
 * The volume above base across every zone of the latest stockpile report: one zone per pile, so a run over two
 * piles is their sum. `null` when there is no stockpile report or it has no zones.
 */
export function stockpileTotal(volumes: readonly VolumeReport[] | null | undefined): number | null {
  const zones = latestVolume(volumes, "stockpile")?.zones ?? [];
  return zones.length ? zones.reduce((sum, z) => sum + z.above_m3, 0) : null;
}
