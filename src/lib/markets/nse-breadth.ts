const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const NSE_HOME = "https://www.nseindia.com";
const NSE_REFERER = `${NSE_HOME}/market-data/live-market-indices`;

export type BreadthSlice = {
  id: string;
  name: string;
  short: string;
  advances: number;
  declines: number;
  unchanged: number;
  total: number;
  advanceShare: number | null;
  last: number | null;
  changePct: number | null;
};

export type MaTape = {
  label: string;
  above: number;
  below: number;
  total: number;
  aboveShare: number | null;
};

export type ThrustTape = {
  universe: number;
  up45: number;
  down45: number;
  up5d20: number;
  down5d20: number;
};

export type NseBreadth = {
  asOf: string;
  source: "nse" | "tradingview";
  exchange: BreadthSlice | null;
  indices: BreadthSlice[];
  sectors: BreadthSlice[];
  movingAverages: { dma20: MaTape | null; dma50: MaTape | null; dma200: MaTape | null };
  thrust: ThrustTape | null;
  week52High: number | null;
  week52Low: number | null;
  error?: string;
};

const INDEX_BOOK: { id: string; nse: string; name: string; short: string; exchange?: boolean }[] = [
  { id: "exchange", nse: "NIFTY TOTAL MARKET", name: "NSE cash", short: "TOTAL MKT", exchange: true },
  { id: "nifty50", nse: "NIFTY 50", name: "Nifty 50", short: "NIFTY" },
  { id: "nifty500", nse: "NIFTY 500", name: "Nifty 500", short: "NIFTY 500" },
  { id: "midcap", nse: "NIFTY MIDCAP 100", name: "Nifty Midcap 100", short: "MIDCAP" },
  { id: "smallcap", nse: "NIFTY SMALLCAP 100", name: "Nifty Smallcap 100", short: "SMLCAP" },
  { id: "banknifty", nse: "NIFTY BANK", name: "Bank Nifty", short: "BANKNIFTY" },
];

type NseIndexRow = {
  key?: string;
  index?: string;
  indexSymbol?: string;
  last?: number | string;
  percentChange?: number | string;
  advances?: number | string;
  declines?: number | string;
  unchanged?: number | string;
};

function emptyTape(): Pick<NseBreadth, "sectors" | "movingAverages" | "thrust"> {
  return {
    sectors: [],
    movingAverages: { dma20: null, dma50: null, dma200: null },
    thrust: null,
  };
}

function keepSector(index: string) {
  const u = index.toUpperCase();
  if (u.includes("25/50") || u.includes("MIDSMALL") || u.includes("NIFTY500") || u.includes("REITS")) {
    return false;
  }
  return true;
}

function sectorName(index: string) {
  return index.replace(/^NIFTY\s+/i, "").replace(/\s+INDEX$/i, "").trim();
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function sliceFromRow(
  book: (typeof INDEX_BOOK)[number],
  row: NseIndexRow | undefined,
): BreadthSlice | null {
  if (!row) return null;
  const advances = num(row.advances);
  const declines = num(row.declines);
  const unchanged = num(row.unchanged) ?? 0;
  if (advances == null || declines == null) return null;
  const total = advances + declines + unchanged;
  return {
    id: book.id,
    name: book.name,
    short: book.short,
    advances,
    declines,
    unchanged,
    total,
    advanceShare: total > 0 ? advances / total : null,
    last: num(row.last),
    changePct: (() => {
      const p = num(row.percentChange);
      return p == null ? null : p / 100;
    })(),
  };
}

function cookieHeader(res: Response) {
  const parts =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return parts
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function nseSession(): Promise<string> {
  const res = await fetch(NSE_REFERER, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": UA,
      Referer: NSE_HOME,
    },
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`nse home ${res.status}`);
  const cookie = cookieHeader(res);
  if (!cookie) throw new Error("nse cookie empty");
  return cookie;
}

async function nseJson<T>(path: string, cookie: string): Promise<T> {
  const res = await fetch(`${NSE_HOME}${path}`, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": UA,
      Referer: NSE_REFERER,
      Cookie: cookie,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`nse ${path} ${res.status}`);
  return (await res.json()) as T;
}

async function count52(path: string, cookie: string): Promise<number | null> {
  try {
    const body = await nseJson<{
      data?: unknown[];
      dataLtpGreater20?: unknown[];
      dataLtpLess20?: unknown[];
    }>(path, cookie);
    const buckets = [body.data, body.dataLtpGreater20, body.dataLtpLess20];
    let n = 0;
    let hit = false;
    for (const b of buckets) {
      if (Array.isArray(b)) {
        hit = true;
        n += b.length;
      }
    }
    return hit ? n : null;
  } catch {
    return null;
  }
}

async function fromNse(): Promise<NseBreadth> {
  const cookie = await nseSession();
  const body = await nseJson<{ data?: NseIndexRow[] }>("/api/allIndices", cookie);
  const rows = body.data ?? [];
  const byName = new Map<string, NseIndexRow>();
  for (const row of rows) {
    const key = (row.index ?? row.indexSymbol ?? "").trim().toUpperCase();
    if (key) byName.set(key, row);
  }

  const parsed = INDEX_BOOK.map((book) => sliceFromRow(book, byName.get(book.nse)));
  let exchange = parsed[0] ?? null;
  const indices = parsed.slice(1).filter((s): s is BreadthSlice => s != null);

  if (!exchange) {
    const nifty500 = indices.find((s) => s.id === "nifty500");
    if (nifty500) {
      exchange = { ...nifty500, id: "exchange", name: "Nifty 500", short: "NIFTY 500" };
    }
  }

  const [week52High, week52Low] = await Promise.all([
    count52("/api/live-analysis-52Week?index=high", cookie),
    count52("/api/live-analysis-52Week?index=low", cookie),
  ]);

  if (!exchange && !indices.length) throw new Error("nse breadth empty");

  const sectors = rows
    .filter((row) => (row.key ?? "").toUpperCase() === "SECTORAL INDICES")
    .filter((row) => keepSector((row.index ?? row.indexSymbol ?? "").trim()))
    .map((row, i) => {
      const raw = (row.index ?? row.indexSymbol ?? "").trim();
      const name = sectorName(raw);
      return sliceFromRow({ id: `sec-${i}`, nse: raw, name, short: name }, row);
    })
    .filter((s): s is BreadthSlice => s != null)
    .sort((a, b) => (b.advanceShare ?? 0) - (a.advanceShare ?? 0));

  return {
    asOf: new Date().toISOString(),
    source: "nse",
    exchange,
    indices,
    ...emptyTape(),
    sectors,
    week52High,
    week52Low,
  };
}

type TvScan = { totalCount?: number; error?: string };
type TvClause = { left: string; operation: string; right: string | number | boolean };

const TV_NSE: TvClause[] = [
  { left: "exchange", operation: "equal", right: "NSE" },
  { left: "type", operation: "equal", right: "stock" },
  { left: "is_primary", operation: "equal", right: true },
];

async function tvCount(extra: TvClause[] = []): Promise<number> {
  const res = await fetch("https://scanner.tradingview.com/india/scan", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": UA,
      Origin: "https://www.tradingview.com",
      Referer: "https://www.tradingview.com/",
    },
    body: JSON.stringify({
      markets: ["india"],
      filter: [...TV_NSE, ...extra],
      columns: ["name"],
      range: [0, 1],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`tv scan ${res.status}`);
  const body = (await res.json()) as TvScan;
  if (body.error) throw new Error(body.error);
  const n = body.totalCount;
  if (n == null || !Number.isFinite(n)) throw new Error("tv scan empty");
  return n;
}

function maTape(label: string, above: number, below: number): MaTape {
  const total = above + below;
  return {
    label,
    above,
    below,
    total,
    aboveShare: total > 0 ? above / total : null,
  };
}

async function fetchParticipation(): Promise<{
  movingAverages: NseBreadth["movingAverages"];
  thrust: ThrustTape;
} | null> {
  try {
    const [universe, a20, b20, a50, b50, a200, b200, up45, down45, up5d20, down5d20] =
      await Promise.all([
        tvCount(),
        tvCount([{ left: "SMA20", operation: "less", right: "close" }]),
        tvCount([{ left: "SMA20", operation: "greater", right: "close" }]),
        tvCount([{ left: "SMA50", operation: "less", right: "close" }]),
        tvCount([{ left: "SMA50", operation: "greater", right: "close" }]),
        tvCount([{ left: "SMA200", operation: "less", right: "close" }]),
        tvCount([{ left: "SMA200", operation: "greater", right: "close" }]),
        tvCount([{ left: "change", operation: "greater", right: 4.5 }]),
        tvCount([{ left: "change", operation: "less", right: -4.5 }]),
        tvCount([{ left: "Perf.5D", operation: "greater", right: 20 }]),
        tvCount([{ left: "Perf.5D", operation: "less", right: -20 }]),
      ]);
    return {
      movingAverages: {
        dma20: maTape("20 DMA", a20, b20),
        dma50: maTape("50 DMA", a50, b50),
        dma200: maTape("200 DMA", a200, b200),
      },
      thrust: { universe, up45, down45, up5d20, down5d20 },
    };
  } catch {
    return null;
  }
}

async function fromTradingView(): Promise<NseBreadth> {
  const [advances, declines, unchanged] = await Promise.all([
    tvCount([{ left: "change", operation: "greater", right: 0 }]),
    tvCount([{ left: "change", operation: "less", right: 0 }]),
    tvCount([{ left: "change", operation: "equal", right: 0 }]),
  ]);
  const total = advances + declines + unchanged;
  const exchange: BreadthSlice = {
    id: "exchange",
    name: "NSE cash",
    short: "NSE",
    advances,
    declines,
    unchanged,
    total,
    advanceShare: total > 0 ? advances / total : null,
    last: null,
    changePct: null,
  };
  return {
    asOf: new Date().toISOString(),
    source: "tradingview",
    exchange,
    indices: [],
    ...emptyTape(),
    week52High: null,
    week52Low: null,
  };
}

function failedBreadth(message: string): NseBreadth {
  return {
    asOf: new Date().toISOString(),
    source: "nse",
    exchange: null,
    indices: [],
    ...emptyTape(),
    week52High: null,
    week52Low: null,
    error: message,
  };
}

export async function fetchNseBreadth(): Promise<NseBreadth> {
  const tapeP = fetchParticipation();
  let base: NseBreadth;
  try {
    base = await fromNse();
  } catch (nseErr) {
    try {
      base = await fromTradingView();
    } catch {
      base = failedBreadth(nseErr instanceof Error ? nseErr.message : "NSE breadth down");
    }
  }
  const tape = await tapeP;
  if (!tape) return base;
  return {
    ...base,
    movingAverages: tape.movingAverages,
    thrust: tape.thrust,
  };
}

export function breadthTone(share: number | null): "gain" | "loss" | "flat" {
  if (share == null) return "flat";
  if (share >= 0.55) return "gain";
  if (share <= 0.45) return "loss";
  return "flat";
}
