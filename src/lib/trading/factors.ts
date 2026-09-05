import { realizedVol, returnsFromPrices, zscore } from "./stats";
import type { FactorId, FactorSnapshot, FactorWeights, Market } from "./types";
import { FACTOR_IDS } from "./types";
import { UNIVERSE } from "./universe";

const WARMUP = 63;

export function rawFactors(market: Market, symbol: string, asOfIndex: number) {
  const bars = market.series[symbol].slice(0, asOfIndex + 1);
  const closes = bars.map((b) => b.close);
  const last = bars[bars.length - 1];
  const window = bars.slice(-21);
  const dollarVol = window.reduce((acc, b) => acc + b.close * b.volume, 0) / window.length;
  const r21 = returnsFromPrices(closes, 21);
  const r63 = returnsFromPrices(closes, 63);
  const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);

  return {
    momentum: 0.6 * r21 + 0.4 * r63,
    meanReversion: ma20 > 0 ? -(last.close / ma20 - 1) : 0,
    lowVol: -realizedVol(closes, 21),
    value: last.earningsYield,
    quality: last.roe,
    liquidity: Math.log(Math.max(1, dollarVol)),
  } satisfies Record<FactorId, number>;
}

export function scoreUniverse(market: Market, asOfIndex: number, weights: FactorWeights): FactorSnapshot[] {
  const usable = Math.max(WARMUP, 0);
  if (asOfIndex < usable) {
    return UNIVERSE.map((n) => ({
      symbol: n.symbol,
      raw: Object.fromEntries(FACTOR_IDS.map((id) => [id, 0])) as Record<FactorId, number>,
      z: Object.fromEntries(FACTOR_IDS.map((id) => [id, 0])) as Record<FactorId, number>,
      composite: 0,
    }));
  }

  const raws = UNIVERSE.map((n) => ({
    symbol: n.symbol,
    raw: rawFactors(market, n.symbol, asOfIndex),
  }));

  const zByFactor = Object.fromEntries(
    FACTOR_IDS.map((id) => [id, zscore(raws.map((r) => r.raw[id]))]),
  ) as Record<FactorId, number[]>;

  const weightSum = FACTOR_IDS.reduce((acc, id) => acc + Math.max(0, weights[id]), 0) || 1;

  return raws
    .map((row, i) => {
      const z = Object.fromEntries(FACTOR_IDS.map((id) => [id, zByFactor[id][i]])) as Record<
        FactorId,
        number
      >;
      const composite = FACTOR_IDS.reduce(
        (acc, id) => acc + (Math.max(0, weights[id]) / weightSum) * z[id],
        0,
      );
      return { symbol: row.symbol, raw: row.raw, z, composite };
    })
    .sort((a, b) => b.composite - a.composite);
}

export function targetBook(
  rankings: FactorSnapshot[],
  longCount: number,
  shortCount: number,
) {
  const longs = rankings.slice(0, Math.max(0, longCount));
  const shorts = shortCount > 0 ? rankings.slice(-shortCount).reverse() : [];
  const longScore = longs.reduce((acc, r) => acc + Math.max(r.composite, 0.05), 0);
  const shortScore = shorts.reduce((acc, r) => acc + Math.max(-r.composite, 0.05), 0);

  const longGross = shortCount > 0 ? 0.5 : 1;
  const shortGross = shortCount > 0 ? 0.5 : 0;

  const targets = [
    ...longs.map((r) => ({
      symbol: r.symbol,
      side: "long" as const,
      composite: r.composite,
      weight: longGross * (Math.max(r.composite, 0.05) / longScore),
    })),
    ...shorts.map((r) => ({
      symbol: r.symbol,
      side: "short" as const,
      composite: r.composite,
      weight: -shortGross * (Math.max(-r.composite, 0.05) / (shortScore || 1)),
    })),
  ];

  return targets;
}
