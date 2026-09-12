const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type YahooChart = {
  chart?: {
    result?: {
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[] };
      meta?: { symbol?: string; regularMarketPrice?: number };
    }[];
    error?: { description?: string };
  };
};

export type CloseSeries = {
  yahoo: string;
  last: number | null;
  closes: number[];
};

async function fetchChart(yahoo: string): Promise<CloseSeries | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?range=2y&interval=1d`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as YahooChart;
  const result = body.chart?.result?.[0];
  const closesRaw = result?.indicators?.quote?.[0]?.close ?? [];
  const closes: number[] = [];
  for (const v of closesRaw) {
    if (v != null && Number.isFinite(v) && v > 0) closes.push(v);
  }
  if (closes.length < 80) return null;
  return {
    yahoo,
    last: result?.meta?.regularMarketPrice ?? closes.at(-1) ?? null,
    closes,
  };
}

export async function fetchFirstSeries(candidates: string[]): Promise<CloseSeries | null> {
  for (const yahoo of candidates) {
    const row = await fetchChart(yahoo);
    if (row) return row;
  }
  return null;
}
