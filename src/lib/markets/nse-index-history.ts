import type { Candle } from "./tv";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const NSE_HOME = "https://www.nseindia.com";
const NSE_REFERER = `${NSE_HOME}/market-data/live-market-indices`;

type NseEod = {
  EOD_CLOSE_INDEX_VAL?: number;
  EOD_OPEN_INDEX_VAL?: number;
  EOD_HIGH_INDEX_VAL?: number;
  EOD_LOW_INDEX_VAL?: number;
  EOD_TIMESTAMP?: string;
  HI_TIMESTAMP?: string;
};

function cookieHeader(res: Response) {
  const parts = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return parts
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

function dmy(iso: string) {
  return `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
}

function shiftIso(iso: string, days: number) {
  const t = Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const next = new Date(t + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

async function nseSession() {
  const res = await fetch(NSE_REFERER, {
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": UA, Referer: NSE_HOME },
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`nse home ${res.status}`);
  const cookie = cookieHeader(res);
  if (!cookie) throw new Error("nse cookie empty");
  return cookie;
}

function toCandle(row: NseEod): Candle | null {
  const close = Number(row.EOD_CLOSE_INDEX_VAL);
  if (!Number.isFinite(close) || close <= 0) return null;
  const stamp = row.HI_TIMESTAMP ? Date.parse(row.HI_TIMESTAMP) : NaN;
  const time = Number.isFinite(stamp) ? Math.floor(stamp / 1000) : NaN;
  if (!Number.isFinite(time)) return null;
  const open = Number(row.EOD_OPEN_INDEX_VAL);
  const high = Number(row.EOD_HIGH_INDEX_VAL);
  const low = Number(row.EOD_LOW_INDEX_VAL);
  return {
    time,
    open: Number.isFinite(open) ? open : close,
    high: Number.isFinite(high) ? high : close,
    low: Number.isFinite(low) ? low : close,
    close,
  };
}

async function fetchWindow(index: string, from: string, to: string, cookie: string) {
  const path = `/api/historicalOR/indicesHistory?indexType=${encodeURIComponent(index)}&from=${encodeURIComponent(dmy(from))}&to=${encodeURIComponent(dmy(to))}`;
  const res = await fetch(`${NSE_HOME}${path}`, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": UA,
      Referer: NSE_REFERER,
      Cookie: cookie,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`nse history ${res.status}`);
  const body = (await res.json()) as { data?: NseEod[] };
  return (body.data ?? []).map(toCandle).filter((c): c is Candle => c != null);
}

/** Daily EOD for an NSE index name such as "NIFTY SMALLCAP 100". */
export async function fetchNseIndexCandles(index: string, from: string, to: string): Promise<Candle[]> {
  const cookie = await nseSession();
  const out: Candle[] = [];
  let cursor = from;
  while (cursor <= to) {
    const chunkEnd = shiftIso(cursor, 80);
    const end = chunkEnd < to ? chunkEnd : to;
    const rows = await fetchWindow(index, cursor, end, cookie);
    out.push(...rows);
    if (end >= to) break;
    cursor = shiftIso(end, 1);
  }
  const byTime = new Map<number, Candle>();
  for (const row of out) byTime.set(row.time, row);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}
