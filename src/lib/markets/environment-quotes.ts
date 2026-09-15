import { ENV_COLUMNS, ENV_YAHOO_SYMBOLS, type EnvQuote } from "./environment";
import { fetchGiftNiftyQuote, GIFT_YAHOO_SENTINEL } from "./gift-nifty";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type SparkRow = {
  symbol?: string;
  fulldayPrice?: number;
  fulldayChange?: number;
  fulldayChangePercent?: number;
  close?: (number | null)[];
  chartPreviousClose?: number;
};

function chunk<T>(xs: T[], n: number) {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

async function sparkBatch(symbols: string[]): Promise<Record<string, SparkRow>> {
  const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${symbols.map(encodeURIComponent).join(",")}&range=5d&interval=1d`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`spark ${res.status}`);
  const body = (await res.json()) as Record<string, SparkRow>;
  return body;
}

function toQuote(id: string, yahoo: string, row: SparkRow | undefined): EnvQuote {
  if (!row) {
    return { id, yahoo, last: null, prevClose: null, change: null, changePct: null, error: "No quote" };
  }
  const last = row.fulldayPrice ?? row.close?.filter((v) => v != null).at(-1) ?? null;
  const change = row.fulldayChange ?? null;
  const pctRaw = row.fulldayChangePercent;
  const changePct = pctRaw == null ? null : pctRaw / 100;
  const priorCloses = row.close?.filter((v): v is number => v != null) ?? [];
  const prevClose =
    row.chartPreviousClose ??
    (last != null && change != null ? last - change : null) ??
    (priorCloses.length >= 2 ? priorCloses[priorCloses.length - 2] : null);
  if (last == null || !Number.isFinite(last)) {
    return { id, yahoo, last: null, prevClose: null, change: null, changePct: null, error: "No last" };
  }
  return {
    id,
    yahoo,
    last,
    prevClose: prevClose != null && Number.isFinite(prevClose) ? prevClose : null,
    change: change != null && Number.isFinite(change) ? change : null,
    changePct: changePct != null && Number.isFinite(changePct) ? changePct : null,
  };
}

export async function fetchEnvironmentQuotes(): Promise<{
  asOf: string;
  quotes: EnvQuote[];
}> {
  const byYahoo: Record<string, SparkRow> = {};
  for (const group of chunk(ENV_YAHOO_SYMBOLS, 8)) {
    try {
      const batch = await sparkBatch(group);
      Object.assign(byYahoo, batch);
    } catch {
      /* leave those symbols empty; UI shows a dash */
    }
  }
  const quotes = ENV_COLUMNS.flatMap((col) =>
    col.rows.map((row) => toQuote(row.id, row.yahoo, byYahoo[row.yahoo])),
  );
  try {
    const gift = await fetchGiftNiftyQuote();
    const i = quotes.findIndex((q) => q.id === "giftnifty");
    if (i >= 0) {
      quotes[i] = {
        id: "giftnifty",
        yahoo: GIFT_YAHOO_SENTINEL,
        last: gift.last,
        prevClose: gift.prevClose,
        change: gift.change,
        changePct: gift.changePct,
        error: gift.last == null ? "No last" : undefined,
      };
    }
  } catch {
    /* gift stays as a dash */
  }
  return { asOf: new Date().toISOString(), quotes };
}
