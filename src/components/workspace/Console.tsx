"use client";

import { useEffect, useRef, useState } from "react";
import type { CommandRecord } from "@/lib/generated/survey";
import { seconds } from "@/lib/format";
import { cx, Segmented } from "@/components/ui";
import { useWorkspace, type LogLine } from "@/components/workspace/context";

const KIND_COLOR: Record<LogLine["kind"], string> = {
  start: "text-accent",
  step: "text-ink-2",
  command: "text-muted",
  warning: "text-warn",
  done: "text-ok",
  error: "text-bad",
  info: "text-data",
};

/** Live step output, and the job's provenance log (every PDAL pipeline and GDAL/PROJ argv, in run order). */
export function Console({ lines, open, onToggle }: { lines: LogLine[]; open: boolean; onToggle: () => void }) {
  const ws = useWorkspace();
  const [tab, setTab] = useState<"live" | "provenance">("live");
  const scroller = useRef<HTMLDivElement>(null);
  const commands = ws.sidecar?.commands ?? [];

  useEffect(() => {
    const el = scroller.current;
    if (el && tab === "live") el.scrollTop = el.scrollHeight;
  }, [lines, tab, open]);

  const last = lines[lines.length - 1];
  return (
    <div className={cx("flex shrink-0 flex-col border-t border-line bg-panel transition-[height]", open ? "h-64" : "h-9")}>
      <div className="flex h-9 shrink-0 items-center gap-3 px-3">
        <button type="button" onClick={onToggle} className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
          <span className={cx("transition", open ? "rotate-90" : "")}>▸</span> Console
        </button>
        {open ? (
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "live", label: "Live" },
              { value: "provenance", label: `Provenance · ${commands.length}` },
            ]}
          />
        ) : (
          last && <span className={cx("num truncate text-[12px]", KIND_COLOR[last.kind])}>{last.text.trim()}</span>
        )}
        <span className="flex-1" />
        {ws.running && (
          <span className="num text-[12px] text-accent">
            {ws.running.sub ?? ws.running.step} · <Elapsed since={ws.running.startedAt} />
          </span>
        )}
      </div>
      {open && (
        <div ref={scroller} className="num min-h-0 flex-1 overflow-auto px-3 pb-2 text-[12px] leading-relaxed">
          {tab === "live" ? (
            lines.length === 0 ? (
              <div className="text-muted">Step output streams here: steps, every tool call with its timing, warnings.</div>
            ) : (
              lines.map((l) => (
                <div key={l.id} className={cx("whitespace-pre-wrap", KIND_COLOR[l.kind])}>
                  <span className="mr-2 text-muted/60">{new Date(l.at).toLocaleTimeString("en-AU", { hour12: false })}</span>
                  {l.text}
                  {l.detail && l.kind === "error" && (
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-bad-soft p-2 text-[11.5px] text-ink-2">{l.detail}</pre>
                  )}
                </div>
              ))
            )
          ) : (
            <Provenance commands={commands} />
          )}
        </div>
      )}
    </div>
  );
}

function Provenance({ commands }: { commands: CommandRecord[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (commands.length === 0) return <div className="text-muted">No commands recorded yet.</div>;
  return (
    <ol className="flex flex-col">
      {commands.map((c, i) => (
        <li key={i} id={`cmd-${i + 1}`} className="border-b border-line/60 py-1">
          <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
            <span className="w-8 text-right text-muted">#{i + 1}</span>
            <span className="w-20 truncate text-data">{c.step}</span>
            <span className={cx("w-24 truncate", c.returncode ? "text-bad" : "text-ink")}>{c.tool}</span>
            <span className="min-w-0 flex-1 truncate text-muted">{c.argv.slice(1).join(" ")}</span>
            <span className="w-16 text-right text-ink-2">{seconds(c.seconds)}</span>
          </button>
          {openIdx === i && (
            <pre className="mt-1 max-h-64 overflow-auto rounded bg-panel-2 p-2 text-[11.5px] text-ink-2">
              {c.argv.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}
              {c.pipeline && "\n\n" + JSON.stringify(c.pipeline, null, 2)}
            </pre>
          )}
        </li>
      ))}
    </ol>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return <>{seconds((now - since) / 1000)}</>;
}
