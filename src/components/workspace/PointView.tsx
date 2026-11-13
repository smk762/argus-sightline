"use client";

/**
 * The job's cloud in 3D: the COPC streamed over HTTP range requests, coarse
 * octree levels first up to a point budget, decoded by laz-perf (WASM served
 * from /laz-perf.wasm) and drawn with three.js around a local origin so float32
 * keeps millimetres.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type * as THREEType from "three";
import { count, num } from "@/lib/format";
import { productUrl } from "@/lib/surveyApi";
import { TASK_BUDGET_MS, yieldToMain } from "@/lib/yieldToMain";
import { Button, cx, Segmented, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/context";

type ColourBy = "z" | "class" | "intensity";

const CLASSES: Record<number, { name: string; rgb: [number, number, number] }> = {
  1: { name: "Unclassified", rgb: [0.62, 0.62, 0.62] },
  2: { name: "Ground", rgb: [0.72, 0.52, 0.28] },
  3: { name: "Low veg", rgb: [0.55, 0.78, 0.42] },
  4: { name: "Medium veg", rgb: [0.3, 0.65, 0.3] },
  5: { name: "High veg", rgb: [0.13, 0.5, 0.22] },
  6: { name: "Building", rgb: [0.9, 0.35, 0.3] },
  7: { name: "Noise", rgb: [1, 0, 1] },
  9: { name: "Water", rgb: [0.2, 0.45, 0.85] },
};

const BUDGETS = [500_000, 1_500_000, 4_000_000] as const;

function ramp(t: number): [number, number, number] {
  const stops: [number, number, number][] = [
    [0.27, 0.0, 0.33],
    [0.23, 0.32, 0.55],
    [0.13, 0.57, 0.55],
    [0.37, 0.79, 0.38],
    [0.99, 0.91, 0.14],
  ];
  const x = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const f = x - i;
  return [0, 1, 2].map((k) => stops[i][k] + (stops[i + 1][k] - stops[i][k]) * f) as [number, number, number];
}

interface Scene {
  renderer: THREEType.WebGLRenderer;
  geom: THREEType.BufferGeometry;
  material: THREEType.PointsMaterial;
  raw: { z: Float32Array; cls: Uint8Array; intensity: Float32Array };
  n: number;
  total: number;
  nodes: number;
  /** Starts or stops the render loop: there is nothing to draw while the view is hidden. */
  setRunning: (on: boolean) => void;
  dispose: () => void;
}

export function PointView({ active }: { active: boolean }) {
  const ws = useWorkspace();
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | null>(null);
  const activeRef = useRef(active);
  const [status, setStatus] = useState<{ phase: "idle" | "loading" | "ready" | "error"; text?: string; frac?: number }>({ phase: "idle" });
  const [colour, setColour] = useState<ColourBy>("class");
  const [size, setSize] = useState(2);
  const [budget, setBudget] = useState<number>(BUDGETS[1]);
  const [classesSeen, setClassesSeen] = useState<number[]>([]);
  const products = ws.sidecar?.products ?? {};
  const kind = products.classified ? "classified" : products.copc ? "copc" : null;
  const sha = kind ? products[kind].sha256 : null;

  // Recolouring up to millions of points is chunked so a colour-mode click stays responsive.
  // A newer paint supersedes one still in progress.
  const paintGen = useRef(0);
  const paint = useCallback(async (mode: ColourBy) => {
    const s = scene.current;
    if (!s) return;
    const gen = ++paintGen.current;
    const col = s.geom.getAttribute("color") as THREEType.BufferAttribute;
    const arr = col.array as Float32Array;
    let lo = 0;
    let hi = 1;
    if (mode !== "class") {
      const src = mode === "z" ? s.raw.z : s.raw.intensity;
      // A typed-array copy sorts numerically and natively: no boxing, no comparator.
      const sample = src.slice(0, Math.min(s.n, 200_000)).sort();
      lo = sample[Math.floor(sample.length * 0.02)] ?? 0;
      hi = sample[Math.floor(sample.length * 0.98)] ?? lo + 1;
      if (hi <= lo) hi = lo + 1;
    }
    let deadline = performance.now() + TASK_BUDGET_MS;
    for (let i = 0; i < s.n; i++) {
      if ((i & 0x3fff) === 0 && performance.now() >= deadline) {
        await yieldToMain();
        if (gen !== paintGen.current || scene.current !== s) return;
        deadline = performance.now() + TASK_BUDGET_MS;
      }
      const rgb =
        mode === "class"
          ? (CLASSES[s.raw.cls[i]]?.rgb ?? [0.8, 0.8, 0.8])
          : ramp(((mode === "z" ? s.raw.z[i] : s.raw.intensity[i]) - lo) / (hi - lo));
      arr[3 * i] = rgb[0];
      arr[3 * i + 1] = rgb[1];
      arr[3 * i + 2] = rgb[2];
    }
    col.needsUpdate = true;
  }, []);

  // The controls' current values, for a load that finishes after they changed.
  const colourRef = useRef(colour);
  const sizeRef = useRef(size);
  // A newer load (Retry, a budget change, a new cloud) or unmounting supersedes one in flight.
  const loadGen = useRef(0);

  const load = useCallback(async () => {
    if (!kind || !host.current) return;
    const gen = ++loadGen.current;
    const stale = () => gen !== loadGen.current;
    scene.current?.dispose();
    scene.current = null;
    const url = productUrl(ws.jobId, kind);
    setStatus({ phase: "loading", text: "Reading the COPC header…", frac: 0 });
    try {
      const [THREE, { OrbitControls }, { Copc }, { createLazPerf }] = await Promise.all([
        import("three"),
        import("three/examples/jsm/controls/OrbitControls.js"),
        import("copc"),
        import("laz-perf"),
      ]);
      const lazPerf = await createLazPerf({ locateFile: () => "/laz-perf.wasm" });
      const copc = await Copc.create(url);
      const { nodes } = await Copc.loadHierarchyPage(url, copc.info.rootHierarchyPage);
      if (stale()) return;
      const keys = Object.keys(nodes)
        .filter((k) => (nodes[k]?.pointCount ?? 0) > 0)
        .sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]));
      const chosen: string[] = [];
      let total = 0;
      for (const k of keys) {
        const c = nodes[k]!.pointCount;
        if (total + c > budget) break;
        chosen.push(k);
        total += c;
      }
      const [minx, miny, minz] = copc.header.min;
      const [maxx, maxy, maxz] = copc.header.max;
      const cx0 = (minx + maxx) / 2;
      const cy0 = (miny + maxy) / 2;
      const pos = new Float32Array(total * 3);
      const raw = { z: new Float32Array(total), cls: new Uint8Array(total), intensity: new Float32Array(total) };
      const seen = new Set<number>();
      let n = 0;
      for (const [i, k] of chosen.entries()) {
        setStatus({ phase: "loading", text: `Node ${i + 1} of ${chosen.length} · ${count(n)} points`, frac: (i + 1) / chosen.length });
        const view = await Copc.loadPointDataView(url, copc, nodes[k]!, {
          lazPerf,
          include: ["X", "Y", "Z", "Classification", "Intensity"],
        });
        if (stale()) return;
        const gx = view.getter("X");
        const gy = view.getter("Y");
        const gz = view.getter("Z");
        const gc = view.getter("Classification");
        const gi = view.getter("Intensity");
        for (let p = 0; p < view.pointCount; p++, n++) {
          const z = gz(p);
          pos[3 * n] = gx(p) - cx0;
          pos[3 * n + 1] = z - minz;
          pos[3 * n + 2] = -(gy(p) - cy0);
          raw.z[n] = z;
          raw.cls[n] = gc(p);
          raw.intensity[n] = gi(p);
          seen.add(raw.cls[n]);
        }
      }
      const el = host.current;
      if (!el || stale()) return;
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(pos.subarray(0, 3 * n), 3));
      geom.setAttribute("color", new THREE.BufferAttribute(new Float32Array(3 * n), 3));
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.setClearColor(0x000000, 0);
      el.appendChild(renderer.domElement);
      const three = new THREE.Scene();
      const span = Math.max(maxx - minx, maxy - miny);
      const camera = new THREE.PerspectiveCamera(50, el.clientWidth / Math.max(1, el.clientHeight), span / 1000, span * 20);
      camera.position.set(span * 0.55, span * 0.45, span * 0.65);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.target.set(0, (maxz - minz) / 4, 0);
      const material = new THREE.PointsMaterial({ size: sizeRef.current, sizeAttenuation: false, vertexColors: true });
      three.add(new THREE.Points(geom, material));
      const frame = () => {
        controls.update();
        renderer.render(three, camera);
      };
      const resize = new ResizeObserver(() => {
        if (!el.clientWidth || !el.clientHeight) return;
        renderer.setSize(el.clientWidth, el.clientHeight);
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
      });
      resize.observe(el);
      scene.current = {
        renderer,
        geom,
        material,
        raw,
        n,
        total: copc.header.pointCount,
        nodes: chosen.length,
        setRunning: (on) => renderer.setAnimationLoop(on ? frame : null),
        dispose: () => {
          resize.disconnect();
          renderer.setAnimationLoop(null);
          controls.dispose();
          geom.dispose();
          material.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        },
      };
      scene.current.setRunning(activeRef.current);
      setClassesSeen([...seen].sort((a, b) => a - b));
      void paint(colourRef.current);
      setStatus({ phase: "ready" });
    } catch (err) {
      if (!stale()) setStatus({ phase: "error", text: (err as Error).message });
    }
  }, [kind, ws.jobId, budget, paint]);

  // load when first shown, and again when the cloud changes (re-ingest / re-classify)
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !sha) return;
    const key = `${sha}:${budget}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    void load();
  }, [active, sha, budget, load]);

  useEffect(() => {
    activeRef.current = active;
    scene.current?.setRunning(active);
  }, [active]);
  useEffect(
    () => () => {
      loadGen.current++;
      scene.current?.dispose();
    },
    [],
  );
  useEffect(() => {
    colourRef.current = colour;
    void paint(colour);
  }, [colour, paint]);
  useEffect(() => {
    sizeRef.current = size;
    if (scene.current) scene.current.material.size = size;
  }, [size]);

  const s = scene.current;
  return (
    <div className="relative h-full w-full bg-map" style={{ background: "radial-gradient(ellipse at 50% 30%, var(--panel-2), var(--map-bg) 70%)" }}>
      <div ref={host} className="absolute inset-0" />

      {status.phase !== "ready" && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="max-w-sm rounded-lg border border-line bg-panel/90 px-4 py-3 text-center text-[13px] shadow-panel">
            {!kind && <span className="text-muted">The point cloud appears here after ingest.</span>}
            {kind && status.phase === "idle" && <span className="text-muted">Streams the job&apos;s COPC over HTTP range requests.</span>}
            {status.phase === "loading" && (
              <div className="flex flex-col items-center gap-2">
                <span className="flex items-center gap-2 text-ink-2">
                  <Spinner /> {status.text}
                </span>
                <div className="h-1 w-56 overflow-hidden rounded-full bg-raised">
                  <div className="h-full bg-accent transition-all" style={{ width: `${(status.frac ?? 0) * 100}%` }} />
                </div>
              </div>
            )}
            {status.phase === "error" && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-bad">Could not stream points: {status.text}</span>
                <Button size="sm" variant="outline" onClick={() => void load()}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {kind && (
        <div className="absolute right-3 top-3 z-10 flex w-56 flex-col gap-2.5 rounded-lg border border-line bg-panel/95 p-3 text-[12.5px] shadow-panel backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="font-medium">Colour by</span>
          </div>
          <Segmented
            value={colour}
            onChange={setColour}
            options={[
              { value: "class", label: "Class" },
              { value: "z", label: "Height" },
              { value: "intensity", label: "Intensity" },
            ]}
          />
          <label className="flex items-center justify-between gap-2 text-muted">
            Point size
            <input type="range" min={1} max={6} step={0.5} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-28 accent-[var(--accent)]" />
          </label>
          <label className="flex items-center justify-between gap-2 text-muted">
            Budget
            <select
              className="rounded border border-line bg-panel-2 px-1.5 py-0.5 text-ink"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            >
              {BUDGETS.map((b) => (
                <option key={b} value={b}>
                  {num(b / 1e6, 1)} M pts
                </option>
              ))}
            </select>
          </label>
          {colour === "class" && classesSeen.length > 0 && (
            <ul className="grid grid-cols-2 gap-x-2 gap-y-1 border-t border-line pt-2">
              {classesSeen.map((c) => (
                <li key={c} className="flex items-center gap-1.5 text-ink-2">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ background: `rgb(${(CLASSES[c]?.rgb ?? [0.8, 0.8, 0.8]).map((v) => Math.round(v * 255)).join(",")})` }}
                  />
                  <span className="truncate">{CLASSES[c]?.name ?? `Class ${c}`}</span>
                </li>
              ))}
            </ul>
          )}
          {s && status.phase === "ready" && (
            <div className={cx("num border-t border-line pt-2 text-[11.5px] text-muted")}>
              {count(s.n)} of {count(s.total)} pts · {s.nodes} nodes
              <br />
              {kind === "classified" ? "classified cloud" : "ingested cloud"} · drag to orbit
            </div>
          )}
        </div>
      )}
    </div>
  );
}
