"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
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
  const [tf, setTf] = useState<TimeframeId>("1D");
  const [swingsOn, setSwingsOn] = useState(true);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const requestKey = `${locale}:${symbol}:${tf}`;

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/ohlc?symbol=${encodeURIComponent(symbol)}&locale=${locale}&tf=${encodeURIComponent(tf)}`,
    )
      .then(async (res) => {
        const body = (await res.json()) as Feed & { error?: string };
        if (!res.ok) throw new Error(body.error ?? res.statusText);
        if (!body.candles?.length) throw new Error("No candles returned");
        if (!cancelled) {
          setFeed(body);
          setError(null);
          setLoadedFor(requestKey);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFeed(null);
          setError(err instanceof Error ? err.message : "Chart feed failed");
          setLoadedFor(requestKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [locale, requestKey, symbol, tf]);

  const pending = loadedFor !== requestKey;
  const status = pending ? "loading" : error ? "error" : "ready";
  const swings = useMemo(
    () => (feed?.candles.length ? findSwings(feed.candles, 2) : []),
    [feed],
  );
  const highs = swings.filter((s) => s.kind === "high").length;
  const lows = swings.filter((s) => s.kind === "low").length;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || status !== "ready" || !feed?.candles.length) return;

    const intraday = tf === "15m" || tf === "1h";
    const chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0d0d0c" },
        textColor: "#c4b89a",
        fontFamily: "ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: "rgba(212, 191, 138, 0.08)" },
        horzLines: { color: "rgba(212, 191, 138, 0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(212, 191, 138, 0.2)" },
      timeScale: {
        borderColor: "rgba(212, 191, 138, 0.2)",
        timeVisible: intraday,
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
    series.setData(
      feed.candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    if (swingsOn) {
      createSeriesMarkers(
        series,
        swings.map((s) =>
          s.kind === "high"
            ? {
                time: s.time as UTCTimestamp,
                position: "aboveBar" as const,
                color: "#d4bf8a",
                shape: "arrowDown" as const,
                text: "H",
              }
            : {
                time: s.time as UTCTimestamp,
                position: "belowBar" as const,
                color: "#3d9a78",
                shape: "arrowUp" as const,
                text: "L",
              },
        ),
      );
    }
    chart.timeScale().fitContent();
    return () => {
      chart.remove();
    };
  }, [feed, status, swings, swingsOn, tf]);

  const message = pending ? `Loading ${tf} candles…` : (error ?? "Loading candles…");

  return (
    <div className={cn("overflow-hidden rounded-xl border border-primary/15 bg-[#0d0d0c]", className)}>
      <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-primary font-mono text-sm">
          {name ?? symbol} · {tv}
          {feed?.last != null && loadedFor === requestKey ? (
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
            Swings{swingsOn && status === "ready" ? ` ${highs}H/${lows}L` : ""}
          </button>
        </div>
      </div>
      {status !== "ready" ? (
        <div className={cn("text-muted-foreground flex items-center justify-center px-4 text-sm", heightClassName)}>
          <div className="max-w-md text-center">
            <p>{message}</p>
            {status === "error" ? (
              <a
                href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tv)}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary mt-2 inline-block hover:underline"
              >
                Open {tv} on TradingView
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <div ref={hostRef} className={cn("w-full", heightClassName)} />
      )}
    </div>
  );
}
