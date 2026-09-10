import type { Candle } from "./tv";
import { DEFAULT_STRATEGY } from "@/lib/news/taxonomy";
import { findSwings } from "./swings";

export type AnalogMatch = {
  id: string;
  date: string;
  similarity: number;
  ret1d: number;
  ret5d: number;
  reversed: boolean;
};

export type TapeBehavior = {
  regime: string;
  regimeNote: string;
  side: "long" | "short" | "skip";
  confidence: number;
  expected1d: number;
  expected5d: number;
  linear1d: number;
  hitRate: number;
  reversalRate: number;
  sampleSize: number;
  cascade: boolean;
  cascadeCount: number;
  echo: boolean;
  intensity: number;
  ret1d: number;
  ret5d: number;
  ret20d: number;
  vol20: number;
  structure: string;
  spark: number[];
  matches: AnalogMatch[];
};

function mean(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function isoDate(time: number) {
  return new Date(time * 1000).toISOString().slice(0, 10);
}

function structureLabel(candles: Candle[]) {
  const swings = findSwings(candles, 2);
  const last = swings.slice(-4);
  if (last.length < 4) return "building";
  const highs = last.filter((s) => s.kind === "high").map((s) => s.price);
  const lows = last.filter((s) => s.kind === "low").map((s) => s.price);
  const hh = highs.length >= 2 && highs[highs.length - 1] > highs[highs.length - 2];
  const hl = lows.length >= 2 && lows[lows.length - 1] > lows[lows.length - 2];
  const lh = highs.length >= 2 && highs[highs.length - 1] < highs[highs.length - 2];
  const ll = lows.length >= 2 && lows[lows.length - 1] < lows[lows.length - 2];
  if (hh && hl) return "HH / HL uptrend";
  if (lh && ll) return "LH / LL downtrend";
  if (hh && ll) return "expanding range";
  if (lh && hl) return "contracting range";
  return "mixed swings";
}

function regimeFrom(ret1d: number, ret5d: number, vol20: number, structure: string, cascadeCount: number) {
  const abs1 = Math.abs(ret1d);
  if (vol20 > 0.018 && abs1 > vol20 * 1.6) {
    return {
      regime: ret1d > 0 ? "Vol impulse up" : "Vol impulse down",
      note: "Move is large versus 20-day vol — treat as an event print, same as a high-intensity headline.",
    };
  }
  if (structure.includes("uptrend") && cascadeCount >= 2) {
    return { regime: "Trend cascade", note: "Same-direction days stacking — cascade boost applies." };
  }
  if (structure.includes("downtrend") && cascadeCount >= 2) {
    return { regime: "Trend cascade", note: "Same-direction days stacking — cascade boost applies." };
  }
  if (structure.includes("contracting")) {
    return { regime: "Squeeze", note: "Swings compressing. Analogues often precede a break." };
  }
  if (Math.sign(ret1d) !== Math.sign(ret5d) && Math.abs(ret5d) > 0.008) {
    return {
      regime: ret1d > 0 ? "Fade / bounce" : "Fade / drop",
      note: "One-day print fights the five-day path — reversal analogues get more weight.",
    };
  }
  if (structure.includes("uptrend")) {
    return { regime: "Uptrend continuation", note: "Higher highs and higher lows on the tape." };
  }
  if (structure.includes("downtrend")) {
    return { regime: "Downtrend continuation", note: "Lower highs and lower lows on the tape." };
  }
  return { regime: "Range / mean reversion", note: "No clean impulse. Neighbors decide skip vs fade." };
}

/**
 * Same method as the news desk: cosine-rhyme analogues, cascade/echo flags,
 * then confidence gates long / short / skip.
 */
export function recognizeTape(candles: Candle[]): TapeBehavior | null {
  if (candles.length < 40) return null;
  const closes = candles.map((c) => c.close);
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    rets.push(closes[i] / closes[i - 1] - 1);
  }
  const n = rets.length;
  const win = 10;
  if (n < win + 8) return null;

  const query = rets.slice(n - win);
  const scored: AnalogMatch[] = [];
  for (let end = win; end < n - 6; end++) {
    const prior = rets.slice(end - win, end);
    const sim = cosine(query, prior);
    if (sim < 0.35) continue;
    const ret1d = rets[end];
    const five = rets.slice(end, end + 5);
    const ret5d = five.reduce((acc, r) => (1 + acc) * (1 + r) - 1, 0);
    const reversed = Math.sign(ret1d) !== Math.sign(ret5d) && Math.abs(ret5d) > 0.002;
    scored.push({
      id: `${end}`,
      date: isoDate(candles[end + 1].time),
      similarity: sim,
      ret1d,
      ret5d,
      reversed,
    });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  const matches = scored.slice(0, 8);

  const w = matches.map((m) => Math.max(m.similarity, 0.01));
  const wsum = w.reduce((a, b) => a + b, 0) || 1;
  const linear1d = matches.length
    ? matches.reduce((acc, m, i) => acc + m.ret1d * w[i], 0) / wsum
    : rets[n - 1];
  let expected1d = linear1d;
  let expected5d = matches.length
    ? matches.reduce((acc, m, i) => acc + m.ret5d * w[i], 0) / wsum
    : rets.slice(-5).reduce((acc, r) => (1 + acc) * (1 + r) - 1, 0);

  let cascadeCount = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (Math.sign(rets[i]) !== Math.sign(rets[n - 1]) || rets[i] === 0) break;
    cascadeCount += 1;
  }
  const cascade = cascadeCount >= 3;
  const echo = matches.some((m) => m.similarity > 0.82 && n - Number(m.id) <= 12);

  if (DEFAULT_STRATEGY.cascadeBoost && cascade) {
    expected1d *= 1.08;
    expected5d *= 1.05;
  }
  if (DEFAULT_STRATEGY.skipEcho && echo) {
    expected1d *= 0.7;
    expected5d *= 0.75;
  }

  const ret1d = rets[n - 1];
  const ret5d = rets.slice(-5).reduce((acc, r) => (1 + acc) * (1 + r) - 1, 0);
  const ret20d = rets.slice(-20).reduce((acc, r) => (1 + acc) * (1 + r) - 1, 0);
  const vol20 = stdev(rets.slice(-20));
  const intensity = vol20 ? Math.min(1, Math.abs(ret1d) / (vol20 * 2.2)) : 0.3;
  const structure = structureLabel(candles);
  const { regime, note } = regimeFrom(ret1d, ret5d, vol20, structure, cascadeCount);

  const hitRate = matches.length
    ? matches.filter((m) => Math.sign(m.ret1d) === Math.sign(expected1d) || expected1d === 0).length /
      matches.length
    : 0.5;
  const reversalRate = matches.length ? matches.filter((m) => m.reversed).length / matches.length : 0.4;

  let confidence =
    Math.min(1, matches.length / 6) * 0.35 +
    intensity * 0.2 +
    (matches[0]?.similarity ?? 0) * 0.25 +
    Math.min(0.15, Math.abs(expected1d) * 4);
  if (DEFAULT_STRATEGY.cascadeBoost && cascade) confidence = Math.min(1, confidence + 0.08);
  if (DEFAULT_STRATEGY.skipEcho && echo) confidence *= 0.55;

  let side: TapeBehavior["side"] = "skip";
  if (confidence >= DEFAULT_STRATEGY.minConfidence && Math.abs(expected1d) >= DEFAULT_STRATEGY.minAbsMove) {
    side = expected1d > 0 ? "long" : "short";
  }

  const spark = closes.slice(-60);

  return {
    regime,
    regimeNote: note,
    side,
    confidence,
    expected1d,
    expected5d,
    linear1d,
    hitRate,
    reversalRate,
    sampleSize: matches.length,
    cascade,
    cascadeCount,
    echo,
    intensity,
    ret1d,
    ret5d,
    ret20d,
    vol20,
    structure,
    spark,
    matches,
  };
}
