import { NextRequest, NextResponse } from "next/server";
import { NSE_LISTINGS } from "@/lib/markets/nse";
import { US_LISTINGS } from "@/lib/markets/us";
import { yahooSymbol, timeframeById } from "@/lib/markets/tv";
import type { Candle } from "@/lib/markets/tv";
import type { ExchangeId } from "@/lib/markets/types";

const ALLOWED = new Set([...NSE_LISTINGS, ...US_LISTINGS].map((l) => l.symbol));

type YahooChart = {
  chart?: {
    result?: {
      timestamp?: number[];
      indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }[] };
      meta?: { symbol?: string; exchangeName?: string; regularMarketPrice?: number; currency?: string };
    }[];
    error?: { description?: string };
  };
};

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "").trim().toUpperCase();
  const locale = (req.nextUrl.searchParams.get("locale") === "NSE" ? "NSE" : "US") as ExchangeId;
  if (!ALLOWED.has(symbol)) {
    return NextResponse.json({ error: "Unknown symbol" }, { status: 404 });
  }

  const ysym = yahooSymbol(symbol, locale);
  const frame = timeframeById(req.nextUrl.searchParams.get("tf") ?? "1D");
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?range=${frame.range}&interval=${frame.interval}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    next: { revalidate: 120 },
  });
  if (!res.ok) {
    return NextResponse.json({ error: `Quote feed ${res.status}` }, { status: 502 });
  }
  const body = (await res.json()) as YahooChart;
  const result = body.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const times = result?.timestamp ?? [];
  if (!result || !quote || !times.length) {
    return NextResponse.json({ error: body.chart?.error?.description ?? "No candles" }, { status: 502 });
  }

  const candles: Candle[] = [];
  for (let i = 0; i < times.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if ([open, high, low, close].some((v) => v == null || !Number.isFinite(v))) continue;
    candles.push({
      time: times[i],
      open: open as number,
      high: high as number,
      low: low as number,
      close: close as number,
    });
  }

  return NextResponse.json({
    symbol,
    yahoo: ysym,
    exchange: result.meta?.exchangeName ?? locale,
    currency: result.meta?.currency ?? (locale === "NSE" ? "INR" : "USD"),
    last: result.meta?.regularMarketPrice ?? candles.at(-1)?.close ?? null,
    timeframe: frame.id,
    candles,
  });
}
