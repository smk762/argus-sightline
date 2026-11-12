"use client";

/** Small primitives shared by every panel. Tailwind classes resolve the theme tokens in globals.css. */

import { createContext, useContext, useEffect, useId, useSyncExternalStore, type ReactNode } from "react";
import { applyTheme, nextTheme, readTheme, serverTheme, subscribeTheme, type Theme } from "@/lib/theme";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Tone = "neutral" | "accent" | "data" | "ok" | "warn" | "bad";

const TONE: Record<Tone, string> = {
  neutral: "bg-raised text-ink-2 border-line",
  accent: "bg-accent-soft text-accent border-accent/40",
  data: "bg-data-soft text-data border-data/40",
  ok: "bg-ok-soft text-ok border-ok/40",
  warn: "bg-warn-soft text-warn border-warn/40",
  bad: "bg-bad-soft text-bad border-bad/50",
};

export function Pill({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={cx("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium", TONE[tone])}
    >
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: Tone }) {
  const c = { neutral: "bg-muted", accent: "bg-accent", data: "bg-data", ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" }[
    tone
  ];
  return <span className={cx("inline-block size-2 rounded-full", c)} />;
}

export function Button({
  children,
  onClick,
  variant = "ghost",
  disabled,
  title,
  type = "button",
  size = "md",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger";
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const v = {
    primary: "bg-accent text-accent-ink hover:brightness-110 border-transparent shadow-[0_0_0_1px_var(--accent)]",
    ghost: "bg-transparent text-ink-2 hover:bg-raised hover:text-ink border-transparent",
    outline: "bg-panel-2 text-ink hover:bg-raised border-line",
    danger: "bg-bad-soft text-bad hover:brightness-110 border-bad/40",
  }[variant];
  const s = { sm: "h-7 px-2.5 text-[12.5px]", md: "h-8 px-3 text-[13px]", lg: "h-10 px-4 text-[14px]" }[size];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md border font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-accent",
        v,
        s,
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * One polite live region for the page. A message is set a moment after the
 * field change, so it doesn't talk over what the screen reader is already
 * reading. Making each error its own live region isn't reliable, because a
 * region that is shown, rather than changed, often isn't announced.
 */
let announcer: HTMLElement | null = null;
let announceTimer: ReturnType<typeof setTimeout> | undefined;
export function announce(message: string): void {
  if (typeof document === "undefined") return;
  if (!announcer?.isConnected) {
    announcer = document.createElement("div");
    announcer.setAttribute("aria-live", "polite");
    announcer.className = "sr-only";
    document.body.append(announcer);
  }
  const region = announcer;
  clearTimeout(announceTimer);
  region.textContent = "";
  announceTimer = setTimeout(() => (region.textContent = message), 500);
}

/** What a Field tells the input inside it: which text describes it and whether it is in error. */
const FieldContext = createContext<{ describedBy?: string; invalid: boolean }>({ invalid: false });

/**
 * A labelled control. `hint` is always linked to the input with aria-describedby.
 * `error` is linked only while it is shown (text that aria-describedby references
 * is read even when hidden), sets aria-invalid and is announced when it appears or changes.
 */
export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;
  useEffect(() => {
    if (error) announce(`${label}: ${error}`);
  }, [error, label]);
  return (
    <FieldContext.Provider value={{ describedBy, invalid: Boolean(error) }}>
      <label className="flex flex-col gap-1">
        <span className="text-[11.5px] font-medium uppercase tracking-wide text-muted">{label}</span>
        {children}
        {error && (
          <span id={errorId} className="text-[12px] text-bad">
            {error}
          </span>
        )}
        {hint && (
          <span id={hintId} className="text-[12px] text-muted">
            {hint}
          </span>
        )}
      </label>
    </FieldContext.Provider>
  );
}

/** ARIA for an input: from its Field, unless the caller states it (an input with no Field around it). */
function useFieldAria(own?: { label?: string; invalid?: boolean; describedBy?: string }) {
  const field = useContext(FieldContext);
  const invalid = own?.invalid ?? field.invalid;
  return {
    "aria-label": own?.label,
    "aria-invalid": invalid,
    "aria-describedby": own?.describedBy ?? field.describedBy,
  };
}

const INPUT =
  "h-8 w-full rounded-md border border-line bg-panel-2 px-2.5 text-[13px] text-ink outline-none transition " +
  "placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:opacity-50";

export function TextInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  list?: string;
  mono?: boolean;
  /** For an input outside a Field. */
  aria?: { label?: string; invalid?: boolean; describedBy?: string };
}) {
  const aria = useFieldAria(props.aria);
  return (
    <input
      {...aria}
      className={cx(INPUT, props.mono && "num", "aria-invalid:border-bad")}
      value={props.value}
      placeholder={props.placeholder}
      disabled={props.disabled}
      list={props.list}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  step = 0.1,
  min,
  suffix,
  disabled,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  suffix?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const aria = useFieldAria();
  return (
    <div className="relative">
      <input
        {...aria}
        type="number"
        className={cx(INPUT, "num pr-10 aria-invalid:border-bad")}
        value={value ?? ""}
        step={step}
        min={min}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[12px] text-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
}) {
  const aria = useFieldAria();
  return (
    <select {...aria} className={cx(INPUT, "aria-invalid:border-bad")} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-2 select-none">
      <span
        className={cx(
          "relative inline-flex h-[18px] w-8 shrink-0 rounded-full border transition",
          checked ? "border-accent bg-accent" : "border-line-strong bg-raised",
        )}
      >
        <span
          className={cx(
            "absolute top-[2px] size-3 rounded-full bg-white shadow transition-all motion-reduce:transition-none",
            checked ? "left-[16px]" : "left-[2px]",
          )}
        />
      </span>
      <input id={id} type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: ReactNode; title?: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-line bg-panel-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded px-2.5 py-1 text-[12.5px] font-medium transition",
            value === o.value ? "bg-raised text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Banner({ tone, title, children }: { tone: "warn" | "bad" | "ok" | "data"; title?: string; children: ReactNode }) {
  return (
    <div className={cx("rounded-md border px-3 py-2 text-[13px]", TONE[tone])}>
      {title && <div className="mb-0.5 font-semibold">{title}</div>}
      <div className="text-ink-2">{children}</div>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
  big,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  big?: boolean;
}) {
  const color = tone ? { neutral: "text-ink", accent: "text-accent", data: "text-data", ok: "text-ok", warn: "text-warn", bad: "text-bad" }[tone] : "text-ink";
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-line bg-panel-2 px-3 py-2.5">
      <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className={cx("num truncate font-semibold", big ? "text-[22px]" : "text-[16px]", color)}>{value}</span>
      {sub && <span className="truncate text-[12px] text-muted">{sub}</span>}
    </div>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,40%)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="truncate text-muted">{k}</dt>
          <dd className="min-w-0 break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("size-4 animate-spin motion-reduce:[animation-duration:6s]", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  // A survey mark: a triangulation station seen from above.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <path d="M16 5 L26 23 H6 Z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="16" cy="16.5" r="2.6" fill="var(--accent)" />
    </svg>
  );
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribeTheme, readTheme, serverTheme);
  const label = { system: "Auto", light: "Light", dark: "Dark" }[theme];
  return (
    <Button size="sm" variant="ghost" onClick={() => applyTheme(nextTheme(theme))} title="Theme: system → light → dark">
      <span aria-hidden>{theme === "light" ? "☀" : theme === "dark" ? "☾" : "◐"}</span>
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
