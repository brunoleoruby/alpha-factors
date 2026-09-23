"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { cn } from "cn";
import type { Candle } from "@/lib/markets/tv";
import {
  DefenceDrawPrimitive,
  type ChartPoint,
  type DefenceDraw,
  type Hit,
} from "@/components/desk/defence-draw-primitive";

const TFS = [
  { id: "1d", label: "1D" },
  { id: "1w", label: "1W" },
  { id: "1m", label: "1M" },
] as const;
type DefenceTf = (typeof TFS)[number]["id"];
type Tool = "none" | "line" | "range" | "rr";

const CANDLE = {
  upColor: "#00e676",
  downColor: "#ff1744",
  borderUpColor: "#00e676",
  borderDownColor: "#ff1744",
  wickUpColor: "#00e676",
  wickDownColor: "#ff1744",
};

type Feed = {
  name: string;
  last: number | null;
  from?: string | null;
  to?: string | null;
  candles: Candle[];
  error?: string;
};

function toBars(candles: Candle[]) {
  const seen = new Set<string>();
  const bars: { time: { year: number; month: number; day: number }; open: number; high: number; low: number; close: number }[] =
    [];
  for (const c of candles) {
    const d = new Date(c.time * 1000);
    const time = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
    const key = `${time.year}-${time.month}-${time.day}`;
    if (seen.has(key)) continue;
    if (![c.open, c.high, c.low, c.close].every((v) => Number.isFinite(v))) continue;
    seen.add(key);
    bars.push({ time, open: c.open, high: c.high, low: c.low, close: c.close });
  }
  return bars;
}

export function DefenceIndexCandle({ theme = "Defence" }: { theme?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const drawRef = useRef<DefenceDrawPrimitive | null>(null);
  const draftRef = useRef<ChartPoint[]>([]);
  const toolRef = useRef<Tool>("none");
  const dragRef = useRef<{ hit: Hit; origin: DefenceDraw; started: boolean } | null>(null);
  const [tf, setTf] = useState<DefenceTf>("1m");
  const [full, setFull] = useState(false);
  const [tool, setTool] = useState<Tool>("none");
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawTick, setDrawTick] = useState(0);

  useEffect(() => {
    toolRef.current = tool;
    const chart = chartRef.current;
    if (!chart) return;
    const drawing = tool !== "none";
    chart.applyOptions({
      handleScroll: !drawing,
      handleScale: !drawing,
    });
  }, [tool]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(host, {
      width: host.clientWidth || 640,
      height: host.clientHeight || 420,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#1a1a1a",
        fontFamily: "ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: "rgba(15, 23, 42, 0.08)" },
        horzLines: { color: "rgba(15, 23, 42, 0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(15, 23, 42, 0.18)" },
      timeScale: { borderColor: "rgba(15, 23, 42, 0.18)", timeVisible: false, secondsVisible: false },
      crosshair: { mode: 0 },
    });
    const series = chart.addSeries(CandlestickSeries, CANDLE);
    const bump = () => setDrawTick((n) => n + 1);
    const draw = new DefenceDrawPrimitive(bump);
    series.attachPrimitive(draw);
    chartRef.current = chart;
    seriesRef.current = series;
    drawRef.current = draw;

    const local = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const freeze = (on: boolean) => {
      chart.applyOptions({ handleScroll: !on, handleScale: !on });
    };
    const finishTool = () => {
      draftRef.current = [];
      toolRef.current = "none";
      setTool("none");
      freeze(false);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const prim = drawRef.current;
      if (!prim) return;
      const { x, y } = local(e);
      const pt = prim.toPoint(x, y);
      const t = toolRef.current;
      if (t !== "none") {
        if (!pt) return;
        host.setPointerCapture(e.pointerId);
        freeze(true);
        if ((t === "line" || t === "range") && draftRef.current.length === 1) {
          prim.add({ kind: t, a: draftRef.current[0], b: pt });
          finishTool();
          return;
        }
        if (t === "rr" && draftRef.current.length === 2) {
          prim.add({ kind: "rr", entry: draftRef.current[0], stop: draftRef.current[1], target: pt });
          finishTool();
          return;
        }
        draftRef.current = [pt];
        prim.setDraft([pt], t);
        return;
      }
      const hit = prim.hit(x, y);
      if (!hit) {
        prim.select(null);
        return;
      }
      const origin = prim.drawings.find((d) => d.id === hit.id);
      if (!origin) return;
      host.setPointerCapture(e.pointerId);
      freeze(true);
      prim.select(hit.id);
      dragRef.current = { hit, origin: structuredClone(origin), started: false };
    };

    const onMove = (e: PointerEvent) => {
      const prim = drawRef.current;
      if (!prim) return;
      const { x, y } = local(e);
      const pt = prim.toPoint(x, y);
      if (!pt) return;
      const t = toolRef.current;
      if (t !== "none" && draftRef.current[0]) {
        if (t === "rr") {
          if (draftRef.current.length === 1) prim.setDraft([draftRef.current[0], pt], "rr");
          else if (draftRef.current[1]) prim.setDraft([draftRef.current[0], draftRef.current[1], pt], "rr");
          return;
        }
        prim.setDraft([draftRef.current[0], pt], t);
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.started) {
        prim.beginEdit();
        drag.started = true;
      }
      prim.applyPoint(drag.hit.id, drag.hit.handle, pt, drag.origin);
    };

    const onUp = (e: PointerEvent) => {
      const prim = drawRef.current;
      if (!prim) return;
      const { x, y } = local(e);
      const pt = prim.toPoint(x, y);
      const t = toolRef.current;
      if ((t === "line" || t === "range") && draftRef.current[0] && pt && draftRef.current.length === 1) {
        const a = draftRef.current[0];
        const ax = chart.timeScale().timeToCoordinate(a.time);
        const ay = series.priceToCoordinate(a.price);
        if (ax != null && ay != null && Math.hypot(x - ax, y - ay) > 8) {
          prim.add({ kind: t, a, b: pt });
          finishTool();
          return;
        }
        freeze(true);
        return;
      }
      if (t === "rr" && draftRef.current.length === 1 && pt) {
        draftRef.current = [draftRef.current[0], pt];
        prim.setDraft(draftRef.current, "rr");
        freeze(true);
        return;
      }
      if (dragRef.current) {
        dragRef.current = null;
        freeze(false);
        prim.refresh();
      }
    };

    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);
    const resize = () => {
      if (!hostRef.current || !chartRef.current) return;
      const { clientWidth, clientHeight } = hostRef.current;
      if (clientWidth < 2 || clientHeight < 2) return;
      chartRef.current.applyOptions({ width: clientWidth, height: clientHeight });
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    return () => {
      ro.disconnect();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      drawRef.current = null;
    };
  }, []);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    fetch(`/api/sector/theme-ohlc?id=${encodeURIComponent(theme)}&tf=${tf}`, { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as Feed;
        if (!res.ok) throw new Error(body.error ?? `Feed ${res.status}`);
        if (!body.candles?.length) throw new Error("No candles");
        if (!dead) {
          setFeed(body);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!dead) {
          setFeed(null);
          setError(err instanceof Error ? err.message : `${theme} candles down`);
        }
      })
      .finally(() => {
        if (!dead) setLoading(false);
      });
    return () => {
      dead = true;
    };
  }, [tf, theme]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || !feed?.candles.length) return;
    try {
      series.setData(toBars(feed.candles));
      chart.timeScale().fitContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draw candles");
    }
  }, [feed]);

  useEffect(() => {
    const onFs = () => {
      setFull(document.fullscreenElement === wrapRef.current);
      requestAnimationFrame(() => {
        if (!hostRef.current || !chartRef.current) return;
        chartRef.current.applyOptions({
          width: hostRef.current.clientWidth,
          height: hostRef.current.clientHeight,
        });
      });
    };
    document.addEventListener("fullscreenchange", onFs);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        drawRef.current?.undo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (drawRef.current?.canDelete) {
          e.preventDefault();
          drawRef.current.deleteSelected();
        }
        return;
      }
      if (e.key !== "Escape") return;
      if (toolRef.current !== "none" || draftRef.current.length) {
        draftRef.current = [];
        drawRef.current?.setDraft([]);
        toolRef.current = "none";
        setTool("none");
        return;
      }
      setFull(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function toggleFull() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      await document.exitFullscreen().catch(() => undefined);
      setFull(false);
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
    try {
      await el.requestFullscreen();
      setFull(true);
    } catch {
      setFull((v) => !v);
    }
  }

  function zoom(factor: number) {
    const ts = chartRef.current?.timeScale();
    const range = ts?.getVisibleLogicalRange();
    if (!ts || !range) return;
    const mid = (range.from + range.to) / 2;
    const span = Math.max(6, (range.to - range.from) * factor);
    ts.setVisibleLogicalRange({ from: mid - span / 2, to: mid + span / 2 });
  }

  function resetView() {
    chartRef.current?.timeScale().fitContent();
  }

  function pickTool(next: Tool) {
    draftRef.current = [];
    drawRef.current?.setDraft([]);
    setTool((prev) => (prev === next ? "none" : next));
  }

  const tfLabel = TFS.find((row) => row.id === tf)?.label ?? tf;
  const canUndo = drawTick >= 0 && Boolean(drawRef.current?.canUndo);
  const canDelete = drawTick >= 0 && Boolean(drawRef.current?.canDelete);

  return (
    <div
      ref={wrapRef}
      className={cn(
        "flex flex-col overflow-hidden bg-white text-black",
        full ? "fixed inset-0 z-[80] h-full" : "rounded-xl",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <p className="font-mono text-xs tracking-wide text-neutral-600 uppercase">
          {feed?.name ?? `EC ${theme} 15`} · {tfLabel} · base 100
          {feed?.from ? ` · ${feed.from.slice(0, 4)}–${(feed.to ?? "").slice(0, 4)}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {TFS.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setTf(row.id)}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-[11px]",
                tf === row.id ? "bg-black text-white" : "text-neutral-600 hover:bg-neutral-100",
              )}
            >
              {row.label}
            </button>
          ))}
          {(
            [
              ["in", "Zoom in", () => zoom(0.7)],
              ["out", "Zoom out", () => zoom(1.45)],
              ["reset", "Reset", resetView],
            ] as const
          ).map(([id, label, fn]) => (
            <button
              key={id}
              type="button"
              onClick={fn}
              className="rounded-md px-2 py-1 font-mono text-[11px] text-neutral-600 hover:bg-neutral-100"
            >
              {label}
            </button>
          ))}
          {(
            [
              ["line", "Line"],
              ["range", "Range"],
              ["rr", "R:R"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => pickTool(id)}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-[11px]",
                tool === id ? "bg-black text-white" : "text-neutral-600 hover:bg-neutral-100",
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            disabled={!canUndo}
            onClick={() => drawRef.current?.undo()}
            className="rounded-md px-2 py-1 font-mono text-[11px] text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            disabled={!canDelete}
            onClick={() => drawRef.current?.deleteSelected()}
            className="rounded-md px-2 py-1 font-mono text-[11px] text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => void toggleFull()}
            className="rounded-md px-2 py-1 text-neutral-600 hover:bg-neutral-100"
            title={full ? "Exit full screen" : "Full screen"}
          >
            {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          <span className="ml-1 font-mono text-sm tabular-nums text-black">
            {loading ? "Loading…" : error ? error : feed?.last == null ? "—" : feed.last.toFixed(2)}
          </span>
        </div>
      </div>
      {tool !== "none" ? (
        <p className="px-4 pb-1 font-mono text-[11px] text-neutral-500">
          {tool === "line"
            ? "Line · drag or click two points · then drag handles to move"
            : tool === "range"
              ? "Price range · drag a box · then drag corners or the box"
              : "R:R · drag entry→stop, click target · then drag levels"}
        </p>
      ) : null}
      <div ref={hostRef} className={cn("w-full min-h-0 bg-white", full ? "flex-1" : "h-[420px]")} />
    </div>
  );
}
