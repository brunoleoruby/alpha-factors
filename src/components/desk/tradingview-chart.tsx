"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { cn } from "cn";
import type { ExchangeId } from "@/lib/markets/types";
import { TIMEFRAMES, tradingViewSymbol, type Candle, type TimeframeId } from "@/lib/markets/tv";
import { findSwings } from "@/lib/markets/swings";

type Feed = {
  candles: Candle[];
  last: number | null;
  currency: string;
  yahoo: string;
  error?: string;
};

function formatLast(n: number, currency: string) {
  if (currency === "INR") {
    return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  }
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function toBars(candles: Candle[]) {
  return candles.map((c) => ({
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

function toMarkers(candles: Candle[]) {
  return findSwings(candles, 2).map((s) =>
    s.kind === "high"
      ? {
          time: s.time as UTCTimestamp,
          position: "atPriceTop" as const,
          price: s.price,
          color: "#d4bf8a",
          shape: "circle" as const,
          size: 0.9,
        }
      : {
          time: s.time as UTCTimestamp,
          position: "atPriceBottom" as const,
          price: s.price,
          color: "#3d9a78",
          shape: "circle" as const,
          size: 0.9,
        },
  );
}

export function TradingViewChart({
  symbol,
  locale,
  name,
  className,
  heightClassName = "h-[420px] md:h-[560px]",
}: {
  symbol: string;
  locale: ExchangeId;
  name?: string;
  className?: string;
  heightClassName?: string;
}) {
  const tv = tradingViewSymbol(symbol, locale);
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const [tf, setTf] = useState<TimeframeId>("1D");
  const [swingsOn, setSwingsOn] = useState(true);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const requestKey = `${locale}:${symbol}:${tf}`;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const chart = createChart(host, {
      width: host.clientWidth || 640,
      height: host.clientHeight || 420,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#334155",
        fontFamily: "ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: "rgba(15, 23, 42, 0.08)" },
        horzLines: { color: "rgba(15, 23, 42, 0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(15, 23, 42, 0.18)" },
      timeScale: {
        borderColor: "rgba(15, 23, 42, 0.18)",
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: { mode: 0 },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#3d9a78",
      downColor: "#a33a4a",
      borderUpColor: "#3d9a78",
      borderDownColor: "#a33a4a",
      wickUpColor: "#3d9a78",
      wickDownColor: "#a33a4a",
    });
    const markers = createSeriesMarkers(series, []);
    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = markers;

    let lastW = 0;
    let lastH = 0;
    const resize = () => {
      if (!hostRef.current || !chartRef.current) return;
      const { clientWidth, clientHeight } = hostRef.current;
      if (clientWidth < 2 || clientHeight < 2) return;
      if (clientWidth === lastW && clientHeight === lastH) return;
      lastW = clientWidth;
      lastH = clientHeight;
      chartRef.current.applyOptions({ width: clientWidth, height: clientHeight });
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    fetch(
      `/api/ohlc?symbol=${encodeURIComponent(symbol)}&locale=${locale}&tf=${encodeURIComponent(tf)}`,
      { signal: ac.signal },
    )
      .then(async (res) => {
        const body = (await res.json()) as Feed & { error?: string };
        if (!res.ok) throw new Error(body.error ?? res.statusText);
        if (!body.candles?.length) throw new Error("No candles returned");
        setFeed(body);
        setError(null);
        setLoadedFor(`${locale}:${symbol}:${tf}`);
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Chart feed failed");
        setLoadedFor(`${locale}:${symbol}:${tf}`);
      });
    return () => ac.abort();
  }, [locale, symbol, tf]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    const markers = markersRef.current;
    if (!series || !chart || !feed?.candles.length) return;
    series.setData(toBars(feed.candles));
    markers?.setMarkers(swingsOn ? toMarkers(feed.candles) : []);
    chart.applyOptions({
      timeScale: { timeVisible: tf === "15m" || tf === "1h", secondsVisible: false },
    });
    chart.timeScale().fitContent();
  }, [feed, swingsOn, tf]);

  const pending = loadedFor !== requestKey;
  const hasChart = Boolean(feed?.candles.length) && !error;
  const swings = useMemo(
    () => (feed?.candles.length ? findSwings(feed.candles, 2) : []),
    [feed],
  );
  const highs = swings.filter((s) => s.kind === "high").length;
  const lows = swings.filter((s) => s.kind === "low").length;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-primary/15 bg-white", className)}>
      <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-primary font-mono text-sm">
          {name ?? symbol} · {tv}
          {feed?.last != null && !pending ? (
            <span className="text-foreground ml-2">{formatLast(feed.last, feed.currency)}</span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {TIMEFRAMES.map((frame) => (
            <button
              key={frame.id}
              type="button"
              onClick={() => setTf(frame.id)}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-[11px]",
                tf === frame.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {frame.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSwingsOn((v) => !v)}
            className={cn(
              "ml-1 rounded-md px-2 py-1 text-[11px] tracking-wide uppercase",
              swingsOn ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
            title="Mark swing highs and lows on this timeframe"
          >
            Swings{swingsOn && hasChart && !pending ? ` ${highs}/${lows}` : ""}
          </button>
        </div>
      </div>
      <div className={cn("relative w-full", heightClassName)}>
        <div ref={hostRef} className="absolute inset-0" />
        {error && !pending ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 px-4 text-center text-sm text-slate-600">
            <div>
              <p className="text-muted-foreground">{error}</p>
              <a
                href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tv)}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary mt-2 inline-block hover:underline"
              >
                Open {tv} on TradingView
              </a>
            </div>
          </div>
        ) : null}
        {pending && !error ? (
          <div className="text-muted-foreground pointer-events-none absolute inset-x-0 top-2 text-center text-xs">
            Loading {tf}…
          </div>
        ) : null}
      </div>
    </div>
  );
}
