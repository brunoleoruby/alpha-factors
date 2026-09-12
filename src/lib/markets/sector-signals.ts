import type { SectorSleeve } from "./sector-live";

export const SKIP_DAYS = 21;
export const FORMATION_DAYS = 126;
export const YEAR_DAYS = 252;
export const VIX_LOW = 20;
export const VIX_HIGH = 25;
export const HOLD_N = 3;

export type VixRegime = "low" | "mid" | "high";

export function lookbackReturn(closes: number[], days: number) {
  if (closes.length < days + 1) return null;
  const end = closes[closes.length - 1];
  const start = closes[closes.length - 1 - days];
  if (!(end > 0) || !(start > 0)) return null;
  return end / start - 1;
}

/** Moskowitz–Grinblatt 6-month formation, skipping the last month (Jegadeesh–Titman). */
export function skipMonthSixReturn(closes: number[]) {
  if (closes.length < SKIP_DAYS + FORMATION_DAYS + 1) return null;
  const end = closes[closes.length - 1 - SKIP_DAYS];
  const start = closes[closes.length - 1 - SKIP_DAYS - FORMATION_DAYS];
  if (!(end > 0) || !(start > 0)) return null;
  return end / start - 1;
}

export function vixRegime(vix: number | null): VixRegime | null {
  if (vix == null || !Number.isFinite(vix)) return null;
  if (vix < VIX_LOW) return "low";
  if (vix > VIX_HIGH) return "high";
  return "mid";
}

export type SignalRow = {
  sector: string;
  yahoo: string;
  sleeve: SectorSleeve;
  mom6: number | null;
  mom12: number | null;
};

export type LiveBook = {
  absMom: number | null;
  riskOn: boolean;
  vix: number | null;
  regime: VixRegime | null;
  ranked: (SignalRow & { rank: number; inBook: boolean })[];
  hold: string[];
  note: string;
};

export function buildLiveBook(
  rows: SignalRow[],
  absMom: number | null,
  vix: number | null,
): LiveBook {
  const rankedBase = [...rows]
    .filter((r) => r.mom6 != null)
    .sort((a, b) => (b.mom6 as number) - (a.mom6 as number));
  const regime = vixRegime(vix);
  const riskOn = absMom == null ? true : absMom >= 0;

  let pool = rankedBase;
  if (regime === "high") {
    const defs = rankedBase.filter((r) => r.sleeve === "defensive");
    if (defs.length >= HOLD_N) pool = defs;
  } else if (regime === "low") {
    const cyc = rankedBase.filter((r) => r.sleeve === "cyclical");
    if (cyc.length >= HOLD_N) pool = cyc;
  }

  const hold = riskOn ? pool.slice(0, HOLD_N).map((r) => r.sector) : [];
  const holdSet = new Set(hold);
  const ranked = [
    ...rankedBase.map((r, i) => ({ ...r, rank: i + 1, inBook: holdSet.has(r.sector) })),
    ...rows
      .filter((r) => r.mom6 == null)
      .map((r) => ({ ...r, rank: 0, inBook: false })),
  ];

  let note = "12-month index gate is closed — hold cash, no sector book.";
  if (riskOn && regime === "high") {
    note = "Index 12-month is up, but vol is high — book is the top defensive sleeves.";
  } else if (riskOn && regime === "low") {
    note = "Index 12-month is up and vol is low — book is the top cyclical sleeves.";
  } else if (riskOn) {
    note = "Index 12-month is up — equal-weight the top three 6-month (skip-1m) sectors.";
  }

  return { absMom, riskOn, vix, regime, ranked, hold, note };
}
