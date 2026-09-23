/** Nifty thematic formula: rank by cap, take N, weight by cap, cap each name, recycle the overflow. */

export const INDEX_SIZE = 15;
export const INDEX_WEIGHT_CAP = 0.2;
export const INDEX_BASE = 1000;

export function cappedMcapWeights(caps: number[], cap = INDEX_WEIGHT_CAP) {
  const n = caps.length;
  const out = new Array(n).fill(0);
  if (n === 0) return out;
  const locked = new Array(n).fill(false);
  let remaining = 1;
  for (let round = 0; round < n + 2; round++) {
    const pool = caps.reduce((sum, v, i) => (locked[i] ? sum : sum + v), 0);
    if (pool <= 0 || remaining <= 1e-15) break;
    let hitCap = false;
    for (let i = 0; i < n; i++) {
      if (locked[i]) continue;
      const w = (remaining * caps[i]) / pool;
      if (w > cap + 1e-12) {
        out[i] = cap;
        locked[i] = true;
        remaining -= cap;
        hitCap = true;
      }
    }
    if (hitCap) continue;
    for (let i = 0; i < n; i++) {
      if (!locked[i]) out[i] = (remaining * caps[i]) / pool;
    }
    break;
  }
  return out;
}

export type ThemeIndexName = {
  symbol: string;
  name: string;
  basic: string;
  marketCap: number;
};

export type ThemeIndexRow = ThemeIndexName & {
  rank: number;
  rawWeight: number;
  weight: number;
  points: number;
};

export type ThemeIndex = {
  id: string;
  name: string;
  formula: string;
  size: number;
  cap: number;
  base: number;
  marketCap: number;
  constituents: ThemeIndexRow[];
};

export function buildThemeIndex(
  names: ThemeIndexName[],
  opts: { id: string; name: string; size?: number; cap?: number; base?: number },
): ThemeIndex {
  const size = opts.size ?? INDEX_SIZE;
  const cap = opts.cap ?? INDEX_WEIGHT_CAP;
  const base = opts.base ?? INDEX_BASE;
  const ranked = [...names]
    .filter((row) => row.marketCap > 0)
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, size);
  const total = ranked.reduce((sum, row) => sum + row.marketCap, 0);
  const raw = ranked.map((row) => (total > 0 ? row.marketCap / total : 0));
  const weights = cappedMcapWeights(
    ranked.map((row) => row.marketCap),
    cap,
  );
  return {
    id: opts.id,
    name: opts.name,
    formula: `Top ${size} by market cap · weight ∝ cap · ${Math.round(cap * 100)}% cap, overflow redistributed`,
    size: ranked.length,
    cap,
    base,
    marketCap: total,
    constituents: ranked.map((row, i) => ({
      ...row,
      rank: i + 1,
      rawWeight: raw[i] ?? 0,
      weight: weights[i] ?? 0,
      points: base * (weights[i] ?? 0),
    })),
  };
}
