"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DoctorReport, HealthInfo, JobDigest } from "@/lib/generated/survey";
import { findKit, KIT_JOB_1, KIT_TRUTH, type DemoKit } from "@/lib/demoKit";
import { ago, count, num } from "@/lib/format";
import { runtimeConfig } from "@/lib/runtimeConfig";
import { getDoctor, getHealth, getInputs, isSafeJobId, listJobs, type Inputs } from "@/lib/surveyApi";
import { STEPS } from "@/lib/workflow";
import { AppHeader } from "@/components/AppHeader";
import { Banner, Button, cx, Dot, Pill, Section, Spinner, TextInput } from "@/components/ui";

export function Dashboard() {
  const router = useRouter();
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [jobs, setJobs] = useState<JobDigest[] | null>(null);
  const [inputs, setInputs] = useState<Inputs | null>(null);
  const [doctor, setDoctor] = useState<(DoctorReport & { ok: boolean }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newId, setNewId] = useState("");

  useEffect(() => {
    let live = true;
    Promise.all([getHealth(), listJobs(), getInputs()])
      .then(([h, j, i]) => {
        if (!live) return;
        setHealth(h);
        setJobs(j.sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
        setInputs(i);
      })
      .catch((e: Error) => live && setError(e.message));
    getDoctor()
      .then((d) => live && setDoctor(d))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const kit = findKit(inputs);
  const canWrite = health ? !health.read_only : false;
  const idOk = newId === "" || isSafeJobId(newId);
  const taken = jobs?.some((j) => j.job_id === newId);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader health={health} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
        <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <div className="flex flex-col justify-center gap-4">
            <Pill tone="data">LiDAR · drone photogrammetry · LAS/LAZ/COPC</Pill>
            <h1 className="text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[42px]">
              From point cloud to <span className="text-accent">defensible</span> survey deliverables.
            </h1>
            <p className="max-w-xl text-[15px] text-ink-2">
              Ground classification, DTM/DSM, contours, stockpile volumes, cut/fill, change between epochs and an
              ASPRS accuracy statement. Every datum is visible, every number carries its uncertainty, and every
              command is in the job&apos;s provenance log.
            </p>
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newId && idOk) router.push(`/jobs/${encodeURIComponent(newId)}`);
              }}
            >
              <div className="w-56">
                <TextInput value={newId} onChange={setNewId} placeholder="new job id, e.g. pit-2026-11" mono />
              </div>
              <Button type="submit" variant="outline" disabled={!newId || !idOk || !canWrite}>
                {taken ? "Open job" : "New survey"}
              </Button>
              {!idOk && <span className="text-[12px] text-bad">letters, digits, . _ - only</span>}
            </form>
          </div>
          <DemoCard kit={kit} canWrite={canWrite} jobs={jobs} loaded={inputs !== null} />
        </section>

        {error && (
          <Banner tone="bad" title="Cannot reach argus-survey">
            {error}. Start it with <code className="num">make up</code> here, or set{" "}
            <code className="num">ARGUS_SURVEY_URL</code> (now{" "}
            <code className="num">{runtimeConfig().surveyUrl || "same origin"}</code>).
          </Banner>
        )}
        {health?.read_only && (
          <Banner tone="warn" title="Read-only server">
            You can browse jobs, maps, the point cloud and reports. To run steps, start argus-survey with{" "}
            <code className="num">SURVEY_ALLOW_PROCESS=1</code>.
          </Banner>
        )}

        <Section title={`Jobs${jobs ? ` · ${jobs.length}` : ""}`}>
          {jobs === null && !error && (
            <div className="flex items-center gap-2 text-muted">
              <Spinner /> Loading jobs…
            </div>
          )}
          {jobs?.length === 0 && <p className="text-muted">No jobs yet. Start the guided demo or a new survey above.</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobs?.map((j) => <JobCard key={j.job_id} job={j} />)}
          </div>
        </Section>

        <Section title="Toolchain">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">argus-survey {health?.version ?? ""}</span>
                {doctor && <Pill tone={doctor.ok ? "ok" : "bad"}>{doctor.ok ? "doctor ok" : "doctor failing"}</Pill>}
              </div>
              <div className="num flex flex-wrap gap-2 text-[12.5px] text-ink-2">
                <span>PDAL {health?.tools.pdal ?? "—"}</span>·<span>GDAL {health?.tools.gdal ?? "—"}</span>·
                <span>PROJ {health?.tools.proj ?? "—"}</span>
              </div>
              <p className="mt-2 text-[12.5px] text-muted">
                PROJ runs offline (<span className="num">PROJ_NETWORK=OFF</span>) with verified datum grids;
                transformations are chosen explicitly, never by PROJ at run time.
              </p>
            </div>
            <div className="max-h-48 overflow-auto rounded-lg border border-line bg-panel p-4">
              {doctor ? (
                <ul className="flex flex-col gap-1 text-[12.5px]">
                  {(doctor.checks ?? []).map((c) => (
                    <li key={c.name} className="flex items-start gap-2">
                      <span className="mt-1">
                        <Dot tone={c.ok ? "ok" : c.required ? "bad" : "warn"} />
                      </span>
                      <span className="text-ink-2">
                        {c.name}
                        {c.detail && <span className="text-muted"> · {c.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted">Doctor report…</span>
              )}
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}

function DemoCard({
  kit,
  canWrite,
  jobs,
  loaded,
}: {
  kit: DemoKit | null;
  canWrite: boolean;
  jobs: JobDigest[] | null;
  loaded: boolean;
}) {
  const started = jobs?.some((j) => j.job_id === KIT_JOB_1);
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-panel p-5 shadow-panel">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-accent-soft blur-2xl" />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Pill tone="accent">Guided demo</Pill>
          <span className="text-[12.5px] text-muted">known answers, no download</span>
        </div>
        <h2 className="text-[18px] font-semibold">A synthetic site near Perth, MGA2020 zone 50 + AHD</h2>
        <ul className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Stockpile", `${num(KIT_TRUTH.stockpileVolume, 1)} m³`],
            ["Growth", `${num(KIT_TRUTH.changeGain, 1)} m³`],
            ["Pad cut", `${num(KIT_TRUTH.padNetCut, 0)} m³`],
          ].map(([k, v]) => (
            <li key={k} className="rounded-md border border-line bg-panel-2 px-2 py-2">
              <div className="text-[11px] uppercase tracking-wide text-muted">{k}</div>
              <div className="num text-[15px] font-semibold text-data">{v}</div>
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-ink-2">
          Two epochs of a cone stockpile on a tilted plane, a building and trees, 40 check points, a design pad.
          Run every step and compare what the toolkit measures with the analytic truth.
        </p>
        {kit ? (
          <Link href={`/jobs/${KIT_JOB_1}?demo=1`} className={cx(!canWrite && !started && "pointer-events-none")}>
            <Button variant="primary" size="lg" className="w-full" disabled={!canWrite && !started}>
              {started ? "Continue the demo →" : "Start the guided demo →"}
            </Button>
          </Link>
        ) : loaded ? (
          <Banner tone="data" title="Demo inputs not found">
            Run <code className="num">make demo-data</code> (writes <code className="num">data/in/kit/</code>), then
            reload.
          </Banner>
        ) : (
          <div className="flex items-center gap-2 text-muted">
            <Spinner /> Looking for the demo kit…
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({ job }: { job: JobDigest }) {
  const done = new Set(job.steps_done);
  return (
    <Link
      href={`/jobs/${encodeURIComponent(job.job_id)}`}
      className="group flex flex-col gap-3 rounded-lg border border-line bg-panel p-4 transition hover:border-accent/60 hover:shadow-panel"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="num truncate text-[15px] font-semibold group-hover:text-accent">{job.job_id}</div>
          <div className="truncate text-[12.5px] text-muted">{job.crs ?? "no CRS yet"}</div>
        </div>
        {job.warnings > 0 && <Pill tone="warn">{job.warnings} warn</Pill>}
      </div>
      <div className="flex gap-1" aria-label={`${done.size} steps done`}>
        {STEPS.map((s) => (
          <span
            key={s.id}
            title={s.label}
            className={cx("h-1.5 flex-1 rounded-full", done.has(s.id) ? "bg-accent" : "bg-raised")}
          />
        ))}
      </div>
      <div className="flex justify-between text-[12px] text-muted">
        <span className="num">{job.points !== null ? `${count(job.points)} pts` : "—"}</span>
        <span>{ago(job.updated_at)}</span>
      </div>
    </Link>
  );
}
