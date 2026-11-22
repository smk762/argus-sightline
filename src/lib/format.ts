/** Number formatting for survey quantities: fixed decimals, thin-space thousands, units always shown. */

const THIN_SPACE = "\u2009";
const formats = new Map<number, Intl.NumberFormat>();

/** `n` with `digits` decimals and thin-space thousands (SI/ISO 80000), whatever the locale groups with. */
function group(n: number, digits: number): string {
  let f = formats.get(digits);
  if (!f) {
    f = new Intl.NumberFormat("en-AU", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      // A negative that rounds to zero shows as "0.0", not "-0.0": there is no measurable sign at that precision.
      signDisplay: "negative",
    });
    formats.set(digits, f);
  }
  return f
    .formatToParts(n)
    .map((p) => (p.type === "group" ? THIN_SPACE : p.value))
    .join("");
}

export function num(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return group(n, digits);
}

export const m3 = (n: number | null | undefined, digits = 1): string => `${num(n, digits)} m³`;
export const m2 = (n: number | null | undefined, digits = 1): string => `${num(n, digits)} m²`;
export const m = (n: number | null | undefined, digits = 3): string => `${num(n, digits)} m`;
export const pct = (n: number | null | undefined, digits = 1): string => `${num(n, digits)} %`;
export const count = (n: number | null | undefined): string => num(n, 0);

/** Metres → centimetres with sign, for residuals and RMSE. */
export const cm = (metres: number | null | undefined, digits = 1): string =>
  metres === null || metres === undefined ? "—" : `${num(metres * 100, digits)} cm`;

export function seconds(s: number | null | undefined): string {
  if (s === null || s === undefined || !Number.isFinite(s)) return "—";
  // Below 0.9995 s the millisecond count stays under 1000; above it, "1.0 s" rather than "1000 ms".
  if (s < 0.9995) return `${Math.round(s * 1000)} ms`;
  if (s < 59.95) return `${s.toFixed(1)} s`;
  const whole = Math.round(s);
  return `${Math.floor(whole / 60)} min ${whole % 60} s`;
}

export function bytes(n: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function ago(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (now.getTime() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
