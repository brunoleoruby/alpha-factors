import { NextRequest, NextResponse } from "next/server";
import { ENV_COLUMNS, envYahooAllowlist } from "@/lib/markets/environment";
import { recognizeTape } from "@/lib/markets/tape-behavior";
import type { Candle } from "@/lib/markets/tv";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type YahooChart = {
  chart?: {
    result?: {
      timestamp?: number[];
      indicators?: {
        quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }[];
      };
    }[];
    error?: { description?: string };
  };
};

function findInstrument(id: string) {
  for (const col of ENV_COLUMNS) {
    const row = col.rows.find((r) => r.id === id);
    if (row) return { column: col, instrument: row };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  const found = findInstrument(id);
  if (!found || !envYahooAllowlist().has(found.instrument.yahoo)) {
    return NextResponse.json({ error: "Unknown ticker" }, { status: 404 });
  }

  const ysym = found.instrument.yahoo;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?range=2y&interval=1d`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
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

  const behavior = recognizeTape(candles);
  if (!behavior) {
    return NextResponse.json({ error: "Not enough history to rhyme this tape" }, { status: 422 });
  }

  return NextResponse.json({
    id: found.instrument.id,
    name: found.instrument.name,
    short: found.instrument.short,
    yahoo: ysym,
    column: found.column.title,
    last: candles.at(-1)?.close ?? null,
    behavior,
  });
}
