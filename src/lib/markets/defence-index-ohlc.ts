import { fetchIndiaSectorCaps, THEME_INDEXES, type ThemeIndustry } from "@/lib/markets/india-sector-mcap";
import { fetchYahooCandles } from "@/lib/markets/yahoo-daily";
import { yahooSymbol } from "@/lib/markets/tv";
import type { Candle } from "@/lib/markets/tv";

/** Chart tape: 100 at first bar; keep the print in the 100–1000s. */
const CHART_BASE = 100;
const CHART_LAST = 1000;

/** 1 Jan 1976 IST — as far back as the user asked; Yahoo only has listed history. */
const FROM_1976 = 189345600;

export const DEFENCE_TFS = [
  { id: "1d", label: "1D", interval: "1d" },
  { id: "1w", label: "1W", interval: "1wk" },
  { id: "1m", label: "1M", interval: "1mo" },
] as const;

export type DefenceTf = (typeof DEFENCE_TFS)[number]["id"];

export function defenceTf(raw: string | null): DefenceTf {
  if (raw === "1d" || raw === "1w" || raw === "1m") return raw;
  return "1m";
}

function yahooInterval(tf: DefenceTf) {
  return DEFENCE_TFS.find((row) => row.id === tf)?.interval ?? "1mo";
}

function istYmd(unix: number) {
  return new Date(unix * 1000 + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

function ymdToUnix(ymd: string) {
  return Math.floor(Date.parse(`${ymd}T10:00:00+05:30`) / 1000);
}

function px(n: number) {
  return Math.round(n * 100) / 100;
}

function toHundreds(candles: Candle[]): Candle[] {
  if (!candles.length) return candles;
  const first = candles[0].close;
  if (!(first > 0)) return candles;
  const rel = candles.map((c) => ({
    time: c.time,
    open: c.open / first,
    high: c.high / first,
    low: c.low / first,
    close: c.close / first,
  }));
  const closes = rel.map((c) => c.close);
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const wide = hi / (lo > 0 ? lo : hi) > 10;
  const scale = (v: number) => {
    if (!wide) return CHART_BASE * v;
    const span = hi - lo || 1;
    return CHART_BASE + (CHART_LAST - CHART_BASE) * ((v - lo) / span);
  };
  return rel.map((c) => {
    const open = px(scale(c.open));
    const high = px(scale(c.high));
    const low = px(scale(c.low));
    const close = px(scale(c.close));
    return {
      time: c.time,
      open,
      high: Math.max(open, high, low, close),
      low: Math.min(open, high, low, close),
      close,
    };
  });
}

export type DefenceIndexOhlc = {
  name: string;
  base: number;
  last: number | null;
  names: number;
  interval: string;
  tf: DefenceTf;
  from: string | null;
  to: string | null;
  candles: Candle[];
};

export function themeIndustry(raw: string | null): ThemeIndustry {
  const hit = THEME_INDEXES.find((row) => row.industry.toLowerCase() === String(raw ?? "").toLowerCase());
  return hit?.industry ?? "Defence";
}

const cache = new Map<string, { at: number; book: DefenceIndexOhlc }>();
const CACHE_MS = 120_000;

export async function fetchDefenceIndexOhlc(tf: DefenceTf = "1m"): Promise<DefenceIndexOhlc> {
  return fetchThemeIndexOhlc("Defence", tf);
}

export async function fetchThemeIndexOhlc(industry: ThemeIndustry, tf: DefenceTf = "1m"): Promise<DefenceIndexOhlc> {
  const key = `${industry}:${tf}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.book;
  const book = await fetchIndiaSectorCaps();
  const index = book.themeIndexes[industry] ?? book.defenceIndex;
  const members = index.constituents.filter((row) => row.weight > 0);
  const now = Math.floor(Date.now() / 1000);
  const interval = yahooInterval(tf);
  const series = await Promise.all(
    members.map(async (row) => {
      try {
        const candles = await fetchYahooCandles(yahooSymbol(row.symbol, "NSE"), {
          interval,
          period1: FROM_1976,
          period2: now,
        });
        const byDay = new Map<string, Candle>();
        for (const bar of candles) byDay.set(istYmd(bar.time), bar);
        return { symbol: row.symbol, weight: row.weight, byDay };
      } catch {
        return { symbol: row.symbol, weight: row.weight, byDay: new Map<string, Candle>() };
      }
    }),
  );
  const live = series.filter((row) => row.byDay.size > 0);
  const days = new Set<string>();
  for (const row of live) {
    for (const day of row.byDay.keys()) days.add(day);
  }
  const rankedDays = [...days].sort();
  const lastClose = new Map<string, number>();
  let prevIndex = CHART_BASE;
  let seeded = false;
  const raw: Candle[] = [];

  for (const day of rankedDays) {
    const present = live.filter((row) => {
      const bar = row.byDay.get(day);
      return bar != null && bar.close > 0;
    });
    if (!present.length) continue;

    if (!seeded) {
      const bar = present[0].byDay.get(day)!;
      raw.push({
        time: ymdToUnix(day),
        open: CHART_BASE * (bar.open / bar.close),
        high: CHART_BASE * (bar.high / bar.close),
        low: CHART_BASE * (bar.low / bar.close),
        close: CHART_BASE,
      });
      for (const row of present) lastClose.set(row.symbol, row.byDay.get(day)!.close);
      seeded = true;
      continue;
    }

    let wSum = 0;
    let open = 0;
    let high = 0;
    let low = 0;
    let close = 0;
    for (const row of present) {
      const bar = row.byDay.get(day)!;
      const prev = lastClose.get(row.symbol);
      if (prev == null || prev <= 0) {
        lastClose.set(row.symbol, bar.close);
        continue;
      }
      wSum += row.weight;
      open += row.weight * (bar.open / prev);
      high += row.weight * (bar.high / prev);
      low += row.weight * (bar.low / prev);
      close += row.weight * (bar.close / prev);
      lastClose.set(row.symbol, bar.close);
    }
    if (wSum <= 0) continue;
    const o = prevIndex * (open / wSum);
    const h = prevIndex * (high / wSum);
    const l = prevIndex * (low / wSum);
    const c = prevIndex * (close / wSum);
    prevIndex = c;
    raw.push({
      time: ymdToUnix(day),
      open: o,
      high: Math.max(o, h, l, c),
      low: Math.min(o, h, l, c),
      close: c,
    });
  }

  const candles = toHundreds(raw);
  const out: DefenceIndexOhlc = {
    name: index.name,
    base: CHART_BASE,
    last: candles.at(-1)?.close ?? null,
    names: live.length,
    interval,
    tf,
    from: rankedDays[0] ?? null,
    to: rankedDays.at(-1) ?? null,
    candles,
  };
  cache.set(key, { at: Date.now(), book: out });
  return out;
}
