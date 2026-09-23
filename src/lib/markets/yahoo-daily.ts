import type { Candle } from "./tv";

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

export async function fetchYahooCandles(
  yahoo: string,
  opts: { interval?: string; range?: string; period1?: number; period2?: number } = {},
): Promise<Candle[]> {
  const interval = opts.interval ?? "1d";
  const params = new URLSearchParams({ interval });
  if (opts.period1 != null && opts.period2 != null) {
    params.set("period1", String(opts.period1));
    params.set("period2", String(opts.period2));
  } else {
    params.set("range", opts.range ?? "2y");
  }
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?${params}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    next: { revalidate: 120 },
  });
  if (!res.ok) throw new Error(`chart ${res.status}`);
  const body = (await res.json()) as YahooChart;
  const result = body.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const times = result?.timestamp ?? [];
  if (!result || !quote || !times.length) {
    throw new Error(body.chart?.error?.description ?? "No candles");
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
  return candles;
}

export async function fetchDailyCandles(yahoo: string): Promise<Candle[]> {
  return fetchYahooCandles(yahoo, { range: "2y", interval: "1d" });
}

function istYmd(unix: number) {
  return new Date(unix * 1000 + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

/** Close-to-close over [from, to] (ISO yyyy-mm-dd, India session dates). */
export function closeToCloseReturn(candles: Candle[], from: string, to: string) {
  if (!candles.length || !from || !to) return null;
  const first = candles.find((c) => istYmd(c.time) >= from);
  const last = [...candles].reverse().find((c) => istYmd(c.time) <= to);
  if (!first || !last || last.time < first.time || !(first.close > 0)) return null;
  return last.close / first.close - 1;
}
