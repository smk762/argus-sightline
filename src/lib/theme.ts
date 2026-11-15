/**
 * Light/dark is the Dragonhound shared script, public/dh-theme.js (a copy of vendor/dh/dh-theme.js;
 * src/lib/shared.test.ts holds them equal). It runs blocking in <head>, sets `data-theme` on <html> before
 * the first paint from a `dh-theme` cookie (Domain .dragonhound.dev on the family's hosts, so the choice
 * follows you between them), handles clicks on any `[data-dh-theme-toggle]` button and keeps their
 * `aria-pressed` in step. globals.css follows `data-theme`, or the system preference without it.
 *
 * React only reads the effective scheme through the script's API (`dhTheme`); it never writes the theme.
 */

export type Scheme = "light" | "dark";

interface DhTheme {
  get(): Scheme | null;
  effective(): Scheme;
  set(theme: Scheme | null): void;
  subscribe(listener: (detail: { theme: Scheme; stored: Scheme | null; source: string }) => void): () => void;
}

declare global {
  interface Window {
    dhTheme?: DhTheme;
  }
}

/** The scheme on screen now. Falls back to `data-theme`, then the system's, if dh-theme.js did not run. */
export function effectiveScheme(): Scheme {
  if (window.dhTheme) return window.dhTheme.effective();
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Server snapshot: unknown, rendered as light (dh-tokens' default) until hydration reads the real one. */
export const serverScheme = (): Scheme => "light";

/** Calls `listener` when the effective scheme changes (toggle, system, another subdomain). */
export function subscribeTheme(listener: () => void): () => void {
  if (window.dhTheme) return window.dhTheme.subscribe(() => listener());
  const media = matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
