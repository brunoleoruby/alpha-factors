"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type BusinessDay,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { cn } from "cn";
import type { ExchangeId } from "@/lib/markets/types";
import { TIMEFRAMES, tradingViewSymbol, type Candle, type TimeframeId } from "@/lib/markets/tv";
import { swingZigzag, threePointSwingHighs, threePointSwingLows } from "@/lib/markets/swings";
import { SwingZigzagPrimitive } from "@/components/desk/swing-zigzag-primitive";

type Feed = {
  candles: Candle[];
  last: number | null;
  currency: string;
  yahoo: string;
  error?: string;
};

const CANDLE_SHOWN = {
  upColor: "#3d9a78",
  downColor: "#a33a4a",
  borderUpColor: "#3d9a78",
  borderDownColor: "#a33a4a",
  wickUpColor: "#3d9a78",
  wickDownColor: "#a33a4a",
};

const CANDLE_HIDDEN = {
  upColor: "rgba(0,0,0,0)",
  downColor: "rgba(0,0,0,0)",
  borderUpColor: "rgba(0,0,0,0)",
  borderDownColor: "rgba(0,0,0,0)",
  wickUpColor: "rgba(0,0,0,0)",
  wickDownColor: "rgba(0,0,0,0)",
};

function formatLast(n: number, currency: string) {
  if (currency === "INR") {
    return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  }
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function isIntraday(tf: TimeframeId) {
  return tf === "15m" || tf === "1h";
}

/** Daily / weekly / monthly bars use calendar days so swing dots stay on the candle. */
function toChartTime(unix: number, tf: TimeframeId): Time {
  if (isIntraday(tf)) return unix as UTCTimestamp;
  const d = new Date(unix * 1000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  } satisfies BusinessDay;
}

function toBars(candles: Candle[], tf: TimeframeId) {
  return candles.map((c) => ({
    time: toChartTime(c.time, tf),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

function toMarkers(candles: Candle[], tf: TimeframeId) {
  const size = tf === "1W" || tf === "1M" ? 1.15 : 0.9;
  const points = [
    ...threePointSwingHighs(candles).map((s) => ({ ...s, color: "#c4b49a" })),
    ...threePointSwingLows(candles).map((s) => ({ ...s, color: "#3d9a78" })),
  ].sort((a, b) => a.time - b.time || (a.kind === "low" ? -1 : 1));
  return points.map((s) => ({
    time: toChartTime(s.time, tf),
    position: "atPriceMiddle" as const,
    price: s.price,
    color: s.color,
    shape: "circle" as const,
    size,
    id: `${s.kind}-${s.time}`,
  }));
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
  const zigzagRef = useRef<SwingZigzagPrimitive | null>(null);
  const [tf, setTf] = useState<TimeframeId>("1D");
  const [swingsOn, setSwingsOn] = useState(true);
  const [candlesOn, setCandlesOn] = useState(true);
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
      ...CANDLE_SHOWN,
    });
    const markers = createSeriesMarkers(series, []);
    const zigzag = new SwingZigzagPrimitive();
    series.attachPrimitive(zigzag);
    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = markers;
    zigzagRef.current = zigzag;

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
      zigzagRef.current = null;
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
    series.setData(toBars(feed.candles, tf));
    chart.applyOptions({
      timeScale: { timeVisible: isIntraday(tf), secondsVisible: false },
    });
    chart.timeScale().fitContent();
    markers?.setMarkers(swingsOn ? toMarkers(feed.candles, tf) : []);
    zigzagRef.current?.setPoints(swingsOn ? swingZigzag(feed.candles) : [], (unix) =>
      toChartTime(unix, tf),
    );
  }, [feed, tf, swingsOn]);

  useEffect(() => {
    seriesRef.current?.applyOptions(candlesOn ? CANDLE_SHOWN : CANDLE_HIDDEN);
  }, [candlesOn, feed]);

  const pending = loadedFor !== requestKey;
  const hasChart = Boolean(feed?.candles.length) && !error;
  const highs = useMemo(
    () => (feed?.candles.length ? threePointSwingHighs(feed.candles).length : 0),
    [feed],
  );
  const lows = useMemo(
    () => (feed?.candles.length ? threePointSwingLows(feed.candles).length : 0),
    [feed],
  );

  return (
    <div className={cn("border-border bg-card overflow-hidden rounded-xl border", className)}>
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
            title="Connect swing high to low and low to high"
          >
            Swings{swingsOn && hasChart && !pending ? ` ${highs}/${lows}` : ""}
          </button>
          <button
            type="button"
            onClick={() => setCandlesOn((v) => !v)}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] tracking-wide uppercase",
              candlesOn ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
            title={candlesOn ? "Hide candlesticks" : "Show candlesticks"}
          >
            Candles
          </button>
        </div>
      </div>
      <div className={cn("relative w-full", heightClassName)}>
        <div ref={hostRef} className="absolute inset-0" />
        {error && !pending ? (
          <div className="bg-card/90 absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
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
