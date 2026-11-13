"use client";

/**
 * The job on a web map. Every layer is a *view* argus-survey derives for the
 * browser (Web Mercator PNG placed by lon/lat corners, WGS 84 GeoJSON); the
 * deliverables themselves stay in the job CRS. Also hosts the drawing tools a
 * volume polygon or a profile line comes from.
 */

import type { GeoJSONSource, Map as MlMap, MapMouseEvent } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RasterView } from "@/lib/generated/survey";
import { bbox, closeRing, lineLength, ringArea, type LonLat } from "@/lib/geo";
import { m, m2, num } from "@/lib/format";
import { runtimeConfig } from "@/lib/runtimeConfig";
import { getRasterView, getVectorView } from "@/lib/surveyApi";
import { subscribeTheme } from "@/lib/theme";
import { Button, cx, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/context";

type LayerKind = "hillshade" | "dtm" | "dsm" | "chm" | "density" | "dod_lod" | "boundary" | "gaps" | "contours_geojson";

const LAYERS: { kind: LayerKind; label: string; raster: boolean; on: boolean; opacity: number }[] = [
  { kind: "hillshade", label: "Hillshade", raster: true, on: true, opacity: 1 },
  { kind: "dtm", label: "DTM (bare earth)", raster: true, on: true, opacity: 0.55 },
  { kind: "dsm", label: "DSM (surface)", raster: true, on: false, opacity: 0.7 },
  { kind: "chm", label: "CHM (heights above ground)", raster: true, on: false, opacity: 0.8 },
  { kind: "density", label: "Point density", raster: true, on: false, opacity: 0.8 },
  { kind: "dod_lod", label: "Change (beyond LoD)", raster: true, on: true, opacity: 0.85 },
  { kind: "boundary", label: "Coverage", raster: false, on: true, opacity: 1 },
  { kind: "gaps", label: "Density gaps", raster: false, on: false, opacity: 0.5 },
  { kind: "contours_geojson", label: "Contours", raster: false, on: true, opacity: 1 },
];

/** The theme in force: an explicit choice on <html>, else the system preference. */
function isDark(): boolean {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** OSM's light tiles under a dark UI glare; dim them so the survey layers carry the contrast. */
const basemapPaint = (dark: boolean) => ({ "raster-brightness-max": dark ? 0.42 : 1, "raster-contrast": dark ? 0.1 : 0 });

const UNITS: Partial<Record<LayerKind, string>> = { dtm: "m", dsm: "m", chm: "m", density: "pts/m²", dod_lod: "m" };

const minPts = (kind: "polygon" | "line") => (kind === "polygon" ? 3 : 2);

/** Keys typed into a field are the field's, not the drawing tool's (Backspace in a zone name must not undo a vertex). */
function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

type LayerDef = (typeof LAYERS)[number];
type Fetched =
  | { l: LayerDef; type: "raster"; view: RasterView & { imageUrl: string } }
  | { l: LayerDef; type: "vector"; data: GeoJSON.FeatureCollection };

interface LayerState {
  on: boolean;
  opacity: number;
  view?: RasterView;
}

export function MapView() {
  const ws = useWorkspace();
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState<Partial<Record<LayerKind, LayerState>>>({});
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<LonLat | null>(null);
  const [panelOpen, setPanelOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 1024);
  const fitted = useRef(false);

  // drawing state lives in refs: MapLibre handlers are registered once
  const drawingRef = useRef(ws.drawing);
  const finishRef = useRef(ws.finishDrawing);
  const verts = useRef<LonLat[]>([]);
  const [draft, setDraft] = useState<LonLat[]>([]);
  useEffect(() => {
    drawingRef.current = ws.drawing;
    finishRef.current = ws.finishDrawing;
    if (ws.drawing) {
      verts.current = [];
      setDraft([]);
    }
  }, [ws.drawing, ws.finishDrawing]);

  // Stable (refs only), so the once-registered MapLibre handlers can call them.
  const addVertex = useCallback((p: LonLat) => {
    verts.current = [...verts.current, p];
    setDraft(verts.current);
  }, []);
  const finishDraft = useCallback(() => {
    const kind = drawingRef.current;
    if (kind && verts.current.length >= minPts(kind)) finishRef.current({ kind, coords: verts.current });
  }, []);

  // ── create the map once ──
  useEffect(() => {
    let disposed = false;
    let map: MlMap | null = null;
    let unsubscribeTheme = () => {};
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (disposed || !box.current) return;
      const cfg = runtimeConfig();
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--map-bg").trim() || "#0e1217";
      map = new maplibregl.Map({
        container: box.current,
        style: {
          version: 8,
          sources: cfg.basemapUrl
            ? {
                basemap: {
                  type: "raster",
                  tiles: [cfg.basemapUrl],
                  tileSize: 256,
                  maxzoom: 19,
                  attribution: cfg.basemapAttribution,
                },
              }
            : {},
          layers: [
            { id: "bg", type: "background", paint: { "background-color": bg } },
            ...(cfg.basemapUrl
              ? [
                  {
                    id: "basemap",
                    type: "raster" as const,
                    source: "basemap",
                    paint: { "raster-saturation": -0.7, "raster-opacity": 0.55, ...basemapPaint(isDark()) },
                  },
                ]
              : []),
          ],
        },
        center: [115.86, -31.95],
        zoom: 10,
        attributionControl: { compact: true },
        maxZoom: 23,
      });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 140 }), "bottom-left");
      map.on("load", () => {
        if (disposed || !map) return;
        map.addSource("draw", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "draw-fill", type: "fill", source: "draw", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#ff7a1a", "fill-opacity": 0.15 } });
        map.addLayer({ id: "draw-line", type: "line", source: "draw", paint: { "line-color": "#ff7a1a", "line-width": 2.5, "line-dasharray": [2, 1] } });
        map.addLayer({ id: "draw-pts", type: "circle", source: "draw", filter: ["==", "$type", "Point"], paint: { "circle-radius": 4.5, "circle-color": "#0b0e12", "circle-stroke-color": "#ff7a1a", "circle-stroke-width": 2 } });
        mapRef.current = map;
        setReady(true);
      });
      unsubscribeTheme = subscribeTheme(() => {
        if (!map?.getLayer("bg")) return;
        // The background follows the theme with or without a basemap (ARGUS_SURVEY_BASEMAP=none).
        const bgNow = getComputedStyle(document.documentElement).getPropertyValue("--map-bg").trim();
        if (bgNow) map.setPaintProperty("bg", "background-color", bgNow);
        if (!map.getLayer("basemap")) return;
        for (const [k, v] of Object.entries(basemapPaint(isDark()))) map.setPaintProperty("basemap", k, v);
      });
      map.on("error", (e) => console.error(`[map] ${(e as { error?: Error }).error?.message ?? "error"}`));
      map.on("mousemove", (e: MapMouseEvent) => setCursor([e.lngLat.lng, e.lngLat.lat]));
      map.on("mouseout", () => setCursor(null));
      map.on("click", (e: MapMouseEvent) => {
        if (drawingRef.current) addVertex([e.lngLat.lng, e.lngLat.lat]);
      });
      map.on("dblclick", (e: MapMouseEvent) => {
        if (!drawingRef.current) return;
        e.preventDefault();
        // Each click of the double-click already dropped a vertex: keep one, not two at the same spot.
        if (verts.current.length) {
          verts.current = verts.current.slice(0, -1);
          setDraft(verts.current);
        }
        finishDraft();
      });
      // Keyboard: MapLibre pans with the arrows and zooms with +/- while the canvas has focus;
      // Enter drops a vertex under the centre reticle.
      const canvas = map.getCanvas();
      canvas.setAttribute("aria-label", "Survey map. Arrow keys pan, plus and minus zoom.");
      canvas.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || !drawingRef.current || !map) return;
        e.preventDefault();
        if (e.shiftKey) finishDraft();
        else addVertex([map.getCenter().lng, map.getCenter().lat]);
      });
    })();
    return () => {
      disposed = true;
      unsubscribeTheme();
      map?.remove();
      mapRef.current = null;
    };
  }, [addVertex, finishDraft]);

  // cursor + double-click zoom while drawing; Escape cancels
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = ws.drawing ? "crosshair" : "";
    if (ws.drawing) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    // The button that started drawing is now disabled, so focus would fall to <body>; put it on the map.
    if (ws.drawing) map.getCanvas().focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      if (e.key === "Escape" && drawingRef.current) finishRef.current(null);
      if (e.key === "Backspace" && drawingRef.current && verts.current.length) {
        verts.current = verts.current.slice(0, -1);
        setDraft(verts.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ws.drawing, ready]);

  // the draft / the finished drawing on the map
  useEffect(() => {
    const src = mapRef.current?.getSource("draw") as GeoJSONSource | undefined;
    if (!src) return;
    const kind = ws.drawing ?? ws.drawn?.kind;
    const pts = ws.drawing ? draft : (ws.drawn?.coords ?? []);
    const features: GeoJSON.Feature[] = pts.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } }));
    if (kind === "polygon" && pts.length >= 3) {
      features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [closeRing(pts)] } });
    } else if (pts.length >= 2) {
      features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts } });
    }
    src.setData({ type: "FeatureCollection", features });
  }, [draft, ws.drawing, ws.drawn, ready]);

  // ── job layers: (re)load when products change ──
  const products = ws.sidecar?.products ?? {};
  const productKey = LAYERS.filter((l) => l.kind in products)
    .map((l) => `${l.kind}:${products[l.kind].sha256.slice(0, 8)}`)
    .join(",");

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    const kinds = new Set(productKey.split(",").map((p) => p.split(":")[0]));
    const present = LAYERS.filter((l) => kinds.has(l.kind));
    (async () => {
      setLoading(present.length > 0);
      // Fetch every view first, then swap the layers in one synchronous block: a load that a newer one
      // superseded (products and mapVersion change together after a step) never touches the map.
      const fetched = await Promise.allSettled(
        present.map(
          async (l): Promise<Fetched> =>
            l.raster
              ? { l, type: "raster", view: await getRasterView(ws.jobId, l.kind) }
              : { l, type: "vector", data: await getVectorView(ws.jobId, l.kind) },
        ),
      );
      if (cancelled) return;
      for (const l of LAYERS) {
        if (map.getLayer(`job-${l.kind}`)) map.removeLayer(`job-${l.kind}`);
        if (map.getSource(`job-${l.kind}`)) map.removeSource(`job-${l.kind}`);
      }
      const next: Partial<Record<LayerKind, LayerState>> = {};
      const extent: LonLat[] = [];
      for (const f of fetched) {
        if (f.status !== "fulfilled") continue; // a view that cannot be derived is skipped; the product still downloads
        const { l } = f.value;
        const prev = layers[l.kind];
        const st: LayerState = { on: prev?.on ?? l.on, opacity: prev?.opacity ?? l.opacity };
        const id = `job-${l.kind}`;
        const vis = st.on ? "visible" : "none";
        if (f.value.type === "raster") {
          const view = f.value.view;
          st.view = view;
          const corners = view.coordinates as [[number, number], [number, number], [number, number], [number, number]];
          extent.push(...(corners as LonLat[]));
          map.addSource(id, { type: "image", url: `${view.imageUrl}?v=${encodeURIComponent(view.png)}`, coordinates: corners });
          map.addLayer(
            { id, type: "raster", source: id, layout: { visibility: vis }, paint: { "raster-opacity": st.opacity, "raster-fade-duration": 0, "raster-resampling": "nearest" } },
            "draw-fill",
          );
        } else {
          map.addSource(id, { type: "geojson", data: f.value.data });
          if (l.kind === "contours_geojson") {
            map.addLayer({ id, type: "line", source: id, layout: { visibility: vis }, paint: { "line-color": "#c9a46a", "line-opacity": 0.75, "line-width": ["case", ["==", ["get", "idx"], 1], 1.6, 0.6] } }, "draw-fill");
          } else if (l.kind === "boundary") {
            map.addLayer({ id, type: "line", source: id, layout: { visibility: vis }, paint: { "line-color": "#38d0e6", "line-width": 1.5, "line-dasharray": [3, 2] } }, "draw-fill");
          } else {
            map.addLayer({ id, type: "fill", source: id, layout: { visibility: vis }, paint: { "fill-color": "#ff5d5d", "fill-opacity": st.opacity } }, "draw-fill");
          }
        }
        next[l.kind] = st;
      }
      setLayers(next);
      setLoading(false);
      const b = bbox(extent);
      if (b && !fitted.current) {
        fitted.current = true;
        map.fitBounds(b, { padding: 48, duration: 900, maxZoom: 20 });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `layers` is read for carry-over only
  }, [productKey, ready, ws.jobId, ws.mapVersion]);

  const setLayer = (kind: LayerKind, patch: Partial<LayerState>) => {
    const map = mapRef.current;
    setLayers((all) => {
      const cur = all[kind];
      if (!cur) return all;
      const next = { ...cur, ...patch };
      const id = `job-${kind}`;
      if (map?.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", next.on ? "visible" : "none");
        const def = LAYERS.find((l) => l.kind === kind);
        if (def?.raster) map.setPaintProperty(id, "raster-opacity", next.opacity);
        else if (kind === "gaps") map.setPaintProperty(id, "fill-opacity", next.opacity);
      }
      return { ...all, [kind]: next };
    });
  };

  const legendKind = (["dod_lod", "chm", "density", "dsm", "dtm"] as LayerKind[]).find((k) => layers[k]?.on && layers[k]?.view?.range);
  const legend = legendKind ? layers[legendKind]?.view : undefined;
  const available = LAYERS.filter((l) => layers[l.kind]);
  const draftPts = ws.drawing ? draft : [];

  return (
    <div className="relative h-full w-full bg-map">
      {/* Inline, not a class: maplibre-gl.css sets `.maplibregl-map { position: relative }` unlayered, which beats
          Tailwind's layered utilities and would collapse the container to zero height. */}
      <div ref={box} style={{ position: "absolute", inset: 0 }} />

      {/* empty state */}
      {ready && available.length === 0 && !loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-lg border border-line bg-panel/90 px-4 py-3 text-center text-[13px] text-muted shadow-panel">
            {ws.sidecar ? "Map layers appear as steps produce them." : "Ingest a point cloud to begin."}
          </div>
        </div>
      )}

      {/* layer panel */}
      {available.length > 0 && (
        <div className="absolute right-12 top-14 z-10 w-60 rounded-lg lg:top-3 border border-line bg-panel/95 text-[12.5px] shadow-panel backdrop-blur">
          <button type="button" className="flex w-full items-center justify-between px-3 py-2 font-medium" onClick={() => setPanelOpen((o) => !o)}>
            <span>Layers {loading && <Spinner className="ml-1 inline size-3" />}</span>
            <span className="text-muted">{panelOpen ? "–" : "+"}</span>
          </button>
          {panelOpen && (
            <ul className="flex flex-col gap-1.5 border-t border-line px-3 py-2">
              {available.map((l) => {
                const st = layers[l.kind]!;
                return (
                  <li key={l.kind} className="flex flex-col gap-1">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" className="accent-[var(--accent)]" checked={st.on} onChange={(e) => setLayer(l.kind, { on: e.target.checked })} />
                      <span className={cx(st.on ? "text-ink" : "text-muted")}>{l.label}</span>
                    </label>
                    {st.on && (l.raster || l.kind === "gaps") && (
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={st.opacity}
                        onChange={(e) => setLayer(l.kind, { opacity: Number(e.target.value) })}
                        className="ml-5 h-1 accent-[var(--accent)]"
                        aria-label={`${l.label} opacity`}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* legend */}
      {legend?.range && legendKind && (
        <div className="absolute bottom-10 right-3 z-10 w-56 rounded-lg border border-line bg-panel/95 px-3 py-2 text-[11.5px] shadow-panel">
          <div className="mb-1 flex justify-between text-muted">
            <span>{LAYERS.find((l) => l.kind === legendKind)?.label}</span>
            <span>{UNITS[legendKind]}</span>
          </div>
          <div
            className="h-2 rounded-sm"
            style={{
              background:
                legend.ramp === "diverging"
                  ? "linear-gradient(90deg, rgb(33,102,172), rgb(247,247,247), rgb(178,24,43))"
                  : "linear-gradient(90deg, rgb(43,131,186), rgb(171,221,164), rgb(255,255,191), rgb(253,174,97), rgb(215,25,28))",
            }}
          />
          <div className="num mt-1 flex justify-between text-ink-2">
            <span>{num(legend.range[0], 2)}</span>
            {legend.ramp === "diverging" && <span>0</span>}
            <span>{num(legend.range[1], 2)}</span>
          </div>
        </div>
      )}

      {/* centre reticle: where Enter (or "Add centre") drops a vertex */}
      {ws.drawing && (
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10 size-5 -translate-x-1/2 -translate-y-1/2">
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-accent" />
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-accent" />
        </div>
      )}

      {/* drawing HUD */}
      {ws.drawing && (
        <div
          role="group"
          aria-label={ws.drawing === "polygon" ? "Polygon drawing" : "Line drawing"}
          className="absolute bottom-10 left-1/2 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border border-accent/50 bg-panel/95 px-4 py-2 text-[12.5px] shadow-panel"
        >
          <span className="font-medium text-accent">{ws.drawing === "polygon" ? "Drawing a polygon" : "Drawing a line"}</span>
          <span className="num text-ink-2" aria-live="polite">
            {ws.drawing === "polygon" ? `≈ ${m2(ringArea(draftPts), 0)}` : `≈ ${m(lineLength(draftPts), 1)}`} · {draftPts.length} pts
          </span>
          <span className="hidden text-muted xl:inline">
            click or Enter to add · double-click or ⇧Enter to finish · ⌫ undo · Esc cancel
          </span>
          <Button size="sm" variant="outline" onClick={() => {
            const c = mapRef.current?.getCenter();
            if (c) addVertex([c.lng, c.lat]);
          }} title="Add a vertex under the centre crosshair (Enter on the map)">
            Add centre
          </Button>
          <Button size="sm" variant="primary" onClick={finishDraft} disabled={draftPts.length < minPts(ws.drawing)} title="Finish (⇧Enter on the map)">
            Finish
          </Button>
          <Button size="sm" variant="ghost" onClick={() => ws.finishDrawing(null)}>
            Cancel
          </Button>
        </div>
      )}

      {/* cursor */}
      {cursor && (
        <div className="num pointer-events-none absolute bottom-2 right-3 z-10 rounded bg-panel/80 px-2 py-0.5 text-[11px] text-muted">
          {cursor[1].toFixed(6)}°, {cursor[0].toFixed(6)}°
        </div>
      )}
    </div>
  );
}
