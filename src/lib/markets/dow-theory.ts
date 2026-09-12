import { SECTOR_YEARS, sectorsFor, type SectorMarket, type SectorScore } from "./sector-returns";

export const DOW_PATH_YEARS = [2020, ...SECTOR_YEARS] as const;

export type DowPrimary = "bull" | "bear" | "non-confirming";
export type DowPhase =
  | "accumulation"
  | "participation"
  | "distribution"
  | "markdown"
  | "line";
export type DowStructure =
  | "HH / HL"
  | "LH / LL"
  | "HH / LL"
  | "LH / HL"
  | "advance"
  | "decline"
  | "building";
export type DowStance = "long" | "short" | "caution" | "skip";

export type DowSwing = {
  year: number;
  price: number;
  kind: "high" | "low";
};

export type DowSectorRead = {
  sector: string;
  proxy: string;
  path: number[];
  swings: DowSwing[];
  structure: DowStructure;
  primary: DowPrimary;
  phase: DowPhase;
  secondary: string;
  stance: DowStance;
  note: string;
  lastYear: number;
  peakTaken: boolean;
  floorTaken: boolean;
};

export type DowPair = {
  a: string;
  b: string;
  label: string;
};

export type DowPairRead = DowPair & {
  aPrimary: DowPrimary;
  bPrimary: DowPrimary;
  confirmed: boolean;
  reading: string;
};

export type DowBook = {
  market: SectorMarket;
  sectors: DowSectorRead[];
  pairs: DowPairRead[];
  bullCount: number;
  bearCount: number;
  mixedCount: number;
  breadth: number;
  keyPair: DowPairRead | null;
  regime: string;
  regimeNote: string;
};

const US_PAIRS: DowPair[] = [
  { a: "Industrials", b: "Energy", label: "Industrials confirm transports analog" },
  { a: "Industrials", b: "Materials", label: "Production confirms commodities" },
  { a: "Financials", b: "Industrials", label: "Credit confirms production" },
  { a: "Technology", b: "Communication", label: "New-economy averages" },
  { a: "Consumer disc.", b: "Industrials", label: "Demand confirms production" },
];

const NSE_PAIRS: DowPair[] = [
  { a: "Bank", b: "Auto", label: "Credit confirms the real economy" },
  { a: "PSU Bank", b: "Infra", label: "Policy credit confirms capex" },
  { a: "Infra", b: "Metal", label: "Capex confirms commodities" },
  { a: "Bank", b: "Realty", label: "Credit confirms property" },
  { a: "IT", b: "Bank", label: "Global risk vs domestic credit" },
];

export const DOW_TENETS = [
  { title: "Averages discount everything", body: "Price already embeds news. We read sector closes, not the headline." },
  { title: "Three trends", body: "Primary (years), secondary (months to a year), minor (noise we ignore on this yearly book)." },
  { title: "Primary has three phases", body: "Bull: accumulation → public participation → distribution. Bear: distribution → markdown → accumulation." },
  { title: "Averages must confirm", body: "A high in one sleeve is not a bull market until its pair makes a matching primary." },
  { title: "Volume confirms", body: "No live volume on this desk book — breadth (how many sectors agree) stands in." },
  { title: "Trend until reversal", body: "Primary stays in force until a previous peak or floor is taken out." },
];

export function indexPath(yearly: number[]) {
  const path = [100];
  for (const r of yearly) path.push(path[path.length - 1] * (1 + r));
  return path;
}

function zigzag(path: number[]): DowSwing[] {
  const raw: DowSwing[] = [];
  for (let i = 1; i < path.length - 1; i++) {
    if (path[i] >= path[i - 1] && path[i] > path[i + 1]) {
      raw.push({ year: DOW_PATH_YEARS[i], price: path[i], kind: "high" });
    } else if (path[i] <= path[i - 1] && path[i] < path[i + 1]) {
      raw.push({ year: DOW_PATH_YEARS[i], price: path[i], kind: "low" });
    }
  }
  const startKind: DowSwing["kind"] = path[0] <= path[1] ? "low" : "high";
  raw.unshift({ year: DOW_PATH_YEARS[0], price: path[0], kind: startKind });
  const last = path.length - 1;
  const endKind: DowSwing["kind"] = path[last] >= path[last - 1] ? "high" : "low";
  raw.push({ year: DOW_PATH_YEARS[last], price: path[last], kind: endKind });

  const out: DowSwing[] = [];
  for (const point of raw) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push(point);
      continue;
    }
    if (prev.kind === point.kind) {
      if (point.kind === "high" && point.price >= prev.price) out[out.length - 1] = point;
      if (point.kind === "low" && point.price <= prev.price) out[out.length - 1] = point;
      continue;
    }
    out.push(point);
  }
  return out;
}

function structureFrom(highs: DowSwing[], lows: DowSwing[]): DowStructure {
  if (highs.length < 2 || lows.length < 2) return "building";
  const hh = highs[highs.length - 1].price > highs[highs.length - 2].price;
  const hl = lows[lows.length - 1].price > lows[lows.length - 2].price;
  const lh = highs[highs.length - 1].price < highs[highs.length - 2].price;
  const ll = lows[lows.length - 1].price < lows[lows.length - 2].price;
  if (hh && hl) return "HH / HL";
  if (lh && ll) return "LH / LL";
  if (hh && ll) return "HH / LL";
  if (lh && hl) return "LH / HL";
  return "building";
}

function phaseFor(row: SectorScore, path: number[], primary: DowPrimary, lastYear: number): DowPhase {
  const max = Math.max(...path);
  const nearHigh = path[path.length - 1] >= max * 0.97;
  const last3 = row.yearly.slice(-3);
  const decelerating =
    last3.length === 3 && last3[2] < last3[1] && last3[1] < last3[0] && last3[2] > -0.02;
  const line =
    Math.abs(row.yearly[row.yearly.length - 1]) < 0.08 &&
    Math.abs(row.yearly[row.yearly.length - 2] ?? 0) < 0.08;

  if (primary === "bear") return lastYear < 0 ? "markdown" : "accumulation";
  if (primary === "non-confirming") return line ? "line" : "accumulation";
  if (line) return "line";
  if (nearHigh && (decelerating || lastYear < 0.06)) return "distribution";
  if (lastYear < 0) return "line";
  return "participation";
}

function stanceFor(primary: DowPrimary, phase: DowPhase): DowStance {
  if (primary === "bear" && phase === "markdown") return "short";
  if (primary === "bull" && phase === "distribution") return "caution";
  if (primary === "bull" && (phase === "participation" || phase === "accumulation")) return "long";
  if (primary === "bull" && phase === "line") return "caution";
  if (primary === "bear" && phase === "accumulation") return "caution";
  return "skip";
}

export function readDowSector(row: SectorScore): DowSectorRead {
  const path = indexPath(row.yearly);
  const swings = zigzag(path);
  const highs = swings.filter((s) => s.kind === "high");
  const lows = swings.filter((s) => s.kind === "low");
  const lastH = highs[highs.length - 1];
  const prevH = highs[highs.length - 2];
  const lastL = lows[lows.length - 1];
  const prevL = lows[lows.length - 2];
  const peakTaken = Boolean(lastH && prevH && lastH.price > prevH.price);
  const floorTaken = Boolean(lastL && prevL && lastL.price < prevL.price);
  const structure = structureFrom(highs, lows);

  let primary: DowPrimary = "non-confirming";
  if (structure === "HH / HL") primary = "bull";
  else if (structure === "LH / LL") primary = "bear";
  else if (peakTaken && !floorTaken) primary = "bull";
  else if (floorTaken && !peakTaken) primary = "bear";
  else if (peakTaken && lastH && lastL && lastH.year >= lastL.year) primary = "bull";
  else if (floorTaken && lastL && lastH && lastL.year >= lastH.year) primary = "bear";

  const lastPx = path[path.length - 1];
  const startPx = path[0];
  if (primary === "non-confirming" && highs.length + lows.length < 4) {
    if (lastPx > startPx * 1.08 && lastPx >= Math.max(...path) * 0.97) primary = "bull";
    else if (lastPx < startPx * 0.92 && lastPx <= Math.min(...path) * 1.03) primary = "bear";
  }

  let labeled: DowStructure = structure;
  if (structure === "building" && primary === "bull") labeled = "advance";
  if (structure === "building" && primary === "bear") labeled = "decline";

  const lastYear = row.yearly[row.yearly.length - 1] ?? 0;
  const phase = phaseFor(row, path, primary, lastYear);

  let secondary = "in gear with the primary";
  if (primary === "bull" && lastYear < 0) secondary = "secondary reaction (down year inside a bull)";
  else if (primary === "bear" && lastYear > 0) secondary = "secondary rally (up year inside a bear)";
  else if (phase === "line") secondary = "Dow line — narrow range, wait for break";

  let note = "Not enough swings to lock a primary.";
  if (labeled === "advance") {
    note = "One-way advance from 2021 — no yearly secondary reaction yet. Primary bull until a lower low.";
  } else if (labeled === "decline") {
    note = "One-way decline from 2021 — no yearly secondary rally yet. Primary bear until a higher high.";
  } else if (primary === "bull" && peakTaken && prevH) {
    note = `Previous peak taken out (${prevH.year} → ${lastH.year}). Primary bull in force until a lower low.`;
  } else if (primary === "bear" && floorTaken && prevL) {
    note = `Previous floor taken out (${prevL.year} → ${lastL.year}). Primary bear in force until a higher high.`;
  } else if (primary === "non-confirming") {
    note = "Swings disagree (new high without a higher low, or the reverse). Dow waits for confirmation.";
  }

  return {
    sector: row.sector,
    proxy: row.proxy,
    path,
    swings,
    structure: labeled,
    primary,
    phase,
    secondary,
    stance: stanceFor(primary, phase),
    note,
    lastYear,
    peakTaken,
    floorTaken,
  };
}

function pairReading(a: DowSectorRead, b: DowSectorRead, pair: DowPair): DowPairRead {
  const confirmed = a.primary !== "non-confirming" && a.primary === b.primary;
  let reading = `${a.sector} is ${a.primary}, ${b.sector} is ${b.primary} — non-confirmation.`;
  if (confirmed && a.primary === "bull") {
    reading = `Both ${a.sector} and ${b.sector} in a primary bull — trend confirmed.`;
  } else if (confirmed && a.primary === "bear") {
    reading = `Both ${a.sector} and ${b.sector} in a primary bear — downtrend confirmed.`;
  }
  return {
    ...pair,
    aPrimary: a.primary,
    bPrimary: b.primary,
    confirmed,
    reading,
  };
}

export function dowForMarket(market: SectorMarket, rows?: SectorScore[]): DowBook {
  const book = rows ?? sectorsFor(market);
  const sectors = book.map(readDowSector);
  const byName = new Map(sectors.map((s) => [s.sector, s]));
  const defs = market === "NSE" ? NSE_PAIRS : US_PAIRS;
  const pairs = defs
    .map((pair) => {
      const a = byName.get(pair.a);
      const b = byName.get(pair.b);
      if (!a || !b) return null;
      return pairReading(a, b, pair);
    })
    .filter((p): p is DowPairRead => p != null);

  const bullCount = sectors.filter((s) => s.primary === "bull").length;
  const bearCount = sectors.filter((s) => s.primary === "bear").length;
  const mixedCount = sectors.length - bullCount - bearCount;
  const breadth = sectors.length ? bullCount / sectors.length : 0;
  const keyPair = pairs[0] ?? null;

  let regime = "Non-confirmation";
  let regimeNote = "Key pair disagrees, or breadth is split. Dow does not call a new primary yet.";
  if (keyPair?.confirmed && keyPair.aPrimary === "bull" && breadth >= 0.55) {
    regime = "Confirmed primary bull";
    regimeNote = `${keyPair.a} and ${keyPair.b} agree, and ${bullCount} of ${sectors.length} sectors are in a primary bull.`;
  } else if (keyPair?.confirmed && keyPair.aPrimary === "bear" && breadth <= 0.45) {
    regime = "Confirmed primary bear";
    regimeNote = `${keyPair.a} and ${keyPair.b} agree lower, and only ${bullCount} of ${sectors.length} sectors remain in a bull.`;
  } else if (keyPair && !keyPair.confirmed) {
    regime = "Non-confirmation";
    regimeNote = keyPair.reading;
  } else if (breadth >= 0.7) {
    regime = "Breadth bull, pair still open";
    regimeNote = "Most sectors are in a primary bull, but the key pair has not locked it.";
  }

  return {
    market,
    sectors,
    pairs,
    bullCount,
    bearCount,
    mixedCount,
    breadth,
    keyPair,
    regime,
    regimeNote,
  };
}
