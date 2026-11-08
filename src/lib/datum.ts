/**
 * Datums in words. Rule 1 of argus-survey is "no silent datums", so the UI
 * always shows the horizontal CRS, the vertical datum (or its absence, or the
 * fact that it was *assumed*), the geoid and the epoch, and colours an assumed or
 * missing vertical datum as a fault rather than a footnote.
 */

import type { CrsRecord, CrsRef } from "@/lib/generated/survey";

export type HeightStatus = "gravity" | "ellipsoidal" | "assumed" | "none";

export interface DatumSummary {
  horizontal: string;
  horizontalCode: string | null;
  vertical: string;
  verticalCode: string | null;
  status: HeightStatus;
  /** One-line explanation for a tooltip. */
  detail: string;
  geoid: string | null;
  epoch: number | null;
  units: string;
}

const code = (ref: CrsRef | null | undefined): string | null => (ref?.epsg ? `EPSG:${ref.epsg}` : null);

export function describeDatum(crs: CrsRecord | null | undefined): DatumSummary | null {
  if (!crs) return null;
  const ref = crs.height_reference ?? "none";
  const status: HeightStatus = crs.vertical_assumed ? "assumed" : ref;
  const vertical =
    crs.vertical?.name ?? (ref === "ellipsoidal" ? "Ellipsoidal heights" : "No vertical datum");
  const detail =
    status === "assumed"
      ? `Vertical datum ASSUMED: ${crs.vertical_assumed}`
      : status === "none"
        ? "Heights have no datum: volumes, contours and accuracy are refused until one is given or assumed."
        : status === "ellipsoidal"
          ? "Heights are ellipsoidal (not AHD): fine for differences, not for levels."
          : crs.geoid
            ? `Heights reduced to ${vertical} through ${crs.geoid}.`
            : `Heights in ${vertical}.`;
  return {
    horizontal: crs.horizontal.name,
    horizontalCode: code(crs.horizontal),
    vertical,
    verticalCode: code(crs.vertical),
    status,
    detail,
    geoid: crs.geoid ?? null,
    epoch: crs.epoch ?? null,
    units: crs.horizontal.units ?? "metre",
  };
}

/** Common Western Australian working CRSs (GDA2020 MGA + AHD via AUSGeoid2020). Free text accepts anything else. */
export const WA_PRESETS: readonly { value: string; label: string }[] = [
  { value: "EPSG:7849+5711", label: "MGA2020 zone 49 + AHD" },
  { value: "EPSG:7850+5711", label: "MGA2020 zone 50 + AHD (Perth)" },
  { value: "EPSG:7851+5711", label: "MGA2020 zone 51 + AHD" },
  { value: "EPSG:7850", label: "MGA2020 zone 50 (keep source heights)" },
];

export const VERTICAL_PRESETS: readonly { value: string; label: string }[] = [
  { value: "EPSG:5711", label: "AHD (EPSG:5711)" },
  { value: "ellipsoidal", label: "Ellipsoidal (GRS80)" },
];
