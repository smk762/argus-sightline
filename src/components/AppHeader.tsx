"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { HealthInfo } from "@/lib/generated/survey";
import { runtimeConfig } from "@/lib/runtimeConfig";
import { Logo, Pill, ThemeToggle } from "@/components/ui";

export function AppHeader({ health, children }: { health: HealthInfo | null; children?: ReactNode }) {
  const studio = runtimeConfig().studioUrl;
  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel/90 px-3 backdrop-blur sm:px-4">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <Logo />
        <span>
          Argus <span className="text-accent">Sightline</span>
        </span>
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      {health && (
        <Pill
          tone={health.read_only ? "warn" : "ok"}
          title={health.read_only ? "SURVEY_ALLOW_PROCESS is off: browse only" : "This server runs steps"}
        >
          {health.read_only ? "read-only" : "processing on"}
        </Pill>
      )}
      {studio && (
        <a href={studio} className="hidden text-[12.5px] text-muted hover:text-ink sm:inline">
          Argus Studio ↗
        </a>
      )}
      <ThemeToggle />
    </header>
  );
}
