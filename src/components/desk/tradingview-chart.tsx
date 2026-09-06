"use client";

import { useEffect, useRef, useState } from "react";
import { CandlestickSeries, ColorType, createChart } from "lightweight-charts";
import { cn } from "cn";
import type { ExchangeId } from "@/lib/markets/types";
import type { Candle } from "@/lib/markets/tv";
import { tradingViewSymbol } from "@/lib/markets/tv";

type Feed = {
  candles: Candle[];
  last: number | null;
  currency: string;
  yahoo: string;
  error?: string;
};

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
  if (locale === "US") {
    return <UsTradingViewEmbed tv={tv} name={name} className={className} heightClassName={heightClassName} />;
  }
  return (
    <NseCandleChart
      symbol={symbol}
      tv={tv}
      name={name}
      className={className}
      heightClassName={heightClassName}
    />
  );
}

function UsTradingViewEmbed({
  tv,
  name,
  className,
  heightClassName,
}: {
  tv: string;
  name?: string;
  className?: string;
  heightClassName?: string;
}) {
  const src = `https://www.tradingview.com/embed-widget/advanced-chart/?locale=en#${encodeURIComponent(
    JSON.stringify({
      autosize: true,
      symbol: tv,
      interval: "D",
      timezone: "exchange",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "#0d0d0c",
      hide_top_toolbar: false,
      allow_symbol_change: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    }),
  )}`;
  return (
    <div className={cn("overflow-hidden rounded-xl border border-primary/15 bg-[#0d0d0c]", className)}>
      <iframe
        key={src}
        title={`TradingView ${name ?? tv}`}
        src={src}
        className={cn("w-full", heightClassName)}
        style={{ border: 0 }}
        allow="clipboard-write; fullscreen"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

function NseCandleChart({
  symbol,
  tv,
  name,
  className,
  heightClassName,
}: {
  symbol: string;
  tv: string;
  name?: string;
  className?: string;
  heightClassName?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ohlc?symbol=${encodeURIComponent(symbol)}&locale=NSE`)
      .then(async (res) => {
        const body = (await res.json()) as Feed & { error?: string };
        if (!res.ok) throw new Error(body.error ?? res.statusText);
        if (!body.candles?.length) throw new Error("No candles returned");
        if (!cancelled) {
          setFeed(body);
          setError(null);
          setLoadedFor(symbol);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFeed(null);
          setError(err instanceof Error ? err.message : "Chart feed failed");
          setLoadedFor(symbol);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const pending = loadedFor !== symbol;
  const status = pending ? "loading" : error ? "error" : "ready";
  const message = pending ? "Loading NSE candles…" : (error ?? "Loading NSE candles…");

  useEffect(() => {
    const host = hostRef.current;
    if (!host || status !== "ready" || !feed?.candles.length) return;

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
      timeScale: { borderColor: "rgba(212, 191, 138, 0.2)", timeVisible: false },
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
        time: c.time as import("lightweight-charts").UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    chart.timeScale().fitContent();
    return () => {
      chart.remove();
    };
  }, [feed, status]);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-primary/15 bg-[#0d0d0c]", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
        <p className="text-primary font-mono text-sm">
          {name ?? symbol} · {tv}
        </p>
        {feed?.last != null ? (
          <p className="font-mono text-sm">
            ₹{feed.last.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </p>
        ) : null}
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
