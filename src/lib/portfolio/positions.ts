import {
  ACCOUNTS,
  SEGMENTS,
  accountLabel,
  inferSegment,
  segmentLabel,
  type TradeAccount,
  type TradeSegment,
  type TradeSource,
} from "./trades";

export type BookSide = "long" | "short";

export type PositionLine = {
  id: string;
  symbol: string;
  isin: string;
  from: string;
  to: string;
  buyDate: string;
  sellDate: string;
  quantity: number;
  buyValue: number;
  sellValue: number;
  buyPrice: number;
  sellPrice: number;
  riskAmount: number;
  realizedPnl: number;
  realizedPnlPct: number;
  prevClose: number;
  openQty: number;
  openQtyType: string;
  openValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  side: BookSide;
  account: TradeAccount;
  segment: TradeSegment;
  source: TradeSource;
  notes: string;
};

export type PnlSummary = {
  account: TradeAccount;
  segment: TradeSegment;
  from: string;
  to: string;
  charges: number;
  otherCreditDebit: number;
  realizedPnl: number;
  unrealizedPnl: number;
  file: string;
};

export type AccountSummaries = Record<string, PnlSummary>;

export function sliceKey(account: TradeAccount, segment: TradeSegment) {
  return `${account}|${segment}`;
}

export type AccountCapitals = Partial<Record<TradeAccount, number>>;

export type PositionBook = {
  positions: PositionLine[];
  summary: PnlSummary | null;
  summaries: AccountSummaries;
  totalCapital: number;
  accountCapitals: AccountCapitals;
};

const KEY = "alpha-factors.positions.v1";

export function emptyPositionBook(): PositionBook {
  return { positions: [], summary: null, summaries: {}, totalCapital: 0, accountCapitals: {} };
}

function isAccount(value: unknown): value is TradeAccount {
  return ACCOUNTS.some((a) => a.id === value);
}

function isSegment(value: unknown): value is TradeSegment {
  return SEGMENTS.some((s) => s.id === value);
}

export function emptyPositionForm() {
  return {
    date: new Date().toISOString().slice(0, 10),
    symbol: "",
    side: "Buy" as "Buy" | "Sell",
    qty: 0,
    price: 0,
    account: "zerodha-tr8076" as TradeAccount,
    segment: "equity" as TradeSegment,
    notes: "",
  };
}

export function positionId(account: TradeAccount, segment: TradeSegment, symbol: string) {
  return `pos-${account}-${segment}-${symbol}`;
}

function isBookSide(value: unknown): value is BookSide {
  return value === "long" || value === "short";
}

export function inferBookSide(row: {
  side?: string;
  buyDate?: string;
  sellDate?: string;
  openQtyType?: string;
  openQty?: number;
}): BookSide {
  if (row.side === "short" || row.side === "long") return row.side;
  const type = (row.openQtyType ?? "").toLowerCase();
  if (type.includes("short") || (row.openQty ?? 0) < 0) return "short";
  if (row.buyDate && row.sellDate && row.sellDate < row.buyDate) return "short";
  return "long";
}

/** Open date: buy for long, sell for short. */
export function entryDate(row: Pick<PositionLine, "side" | "buyDate" | "sellDate" | "openQtyType" | "openQty">) {
  return inferBookSide(row) === "short" ? row.sellDate : row.buyDate;
}

/** Close date: sell for long, buy (cover) for short. */
export function exitDate(row: Pick<PositionLine, "side" | "buyDate" | "sellDate" | "openQtyType" | "openQty">) {
  return inferBookSide(row) === "short" ? row.buyDate : row.sellDate;
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normalizePosition(raw: Record<string, unknown>): PositionLine | null {
  if (typeof raw.id !== "string" || typeof raw.symbol !== "string") return null;
  const symbol = raw.symbol.trim().toUpperCase();
  if (!symbol) return null;
  const buyDate = typeof raw.buyDate === "string" ? raw.buyDate : "";
  const sellDate = typeof raw.sellDate === "string" ? raw.sellDate : "";
  const openQty = num(raw.openQty);
  const openQtyType = typeof raw.openQtyType === "string" ? raw.openQtyType : "";
  const side = isBookSide(raw.side)
    ? raw.side
    : inferBookSide({ buyDate, sellDate, openQtyType, openQty });
  return {
    id: raw.id,
    symbol,
    isin: typeof raw.isin === "string" ? raw.isin : "",
    from: typeof raw.from === "string" ? raw.from : "",
    to: typeof raw.to === "string" ? raw.to : "",
    buyDate,
    sellDate,
    quantity: num(raw.quantity),
    buyValue: num(raw.buyValue),
    sellValue: num(raw.sellValue),
    buyPrice: num(raw.buyPrice),
    sellPrice: num(raw.sellPrice),
    riskAmount: num(raw.riskAmount),
    realizedPnl: num(raw.realizedPnl),
    realizedPnlPct: num(raw.realizedPnlPct),
    prevClose: num(raw.prevClose),
    openQty,
    openQtyType,
    openValue: num(raw.openValue),
    unrealizedPnl: num(raw.unrealizedPnl),
    unrealizedPnlPct: num(raw.unrealizedPnlPct),
    side,
    account: isAccount(raw.account) ? raw.account : "zerodha-tr8076",
    segment: isSegment(raw.segment) ? raw.segment : inferSegment(raw.segment),
    source: raw.source === "file" ? "file" : "desk",
    notes: typeof raw.notes === "string" ? raw.notes : "",
  };
}

export function parsePositionBook(raw: unknown): PositionBook {
  if (!raw || typeof raw !== "object") return emptyPositionBook();
  const rec = raw as Record<string, unknown>;
  const list = Array.isArray(raw) ? raw : rec.positions;
  const parsed = Array.isArray(list)
    ? list
        .map((row) =>
          row && typeof row === "object" ? normalizePosition(row as Record<string, unknown>) : null,
        )
        .filter((row): row is PositionLine => row !== null)
    : [];
  const summary =
    rec.summary && typeof rec.summary === "object"
      ? normalizeSummary(rec.summary as Record<string, unknown>)
      : null;
  const summaries = parseSummaries(rec.summaries);
  if (summary) {
    const key = sliceKey(summary.account, summary.segment);
    if (!summaries[key]) summaries[key] = summary;
  }
  const positions = parsed.map((row) => {
    const period = summaries[sliceKey(row.account, row.segment)] ?? summary;
    if (period && (!row.from || !row.to)) {
      return { ...row, from: row.from || period.from, to: row.to || period.to };
    }
    return row;
  });
  return {
    positions,
    summary: summary ?? Object.values(summaries)[0] ?? null,
    summaries,
    totalCapital: num(rec.totalCapital),
    accountCapitals: parseAccountCapitals(rec.accountCapitals),
  };
}

function parseAccountCapitals(raw: unknown): AccountCapitals {
  const out: AccountCapitals = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isAccount(key)) out[key] = num(value);
  }
  return out;
}

export function capitalForView(
  view: "all" | TradeAccount,
  totalCapital: number,
  accountCapitals: AccountCapitals,
) {
  if (view === "all") return totalCapital;
  return num(accountCapitals[view]);
}

export function mergeAccountCapitals(primary: AccountCapitals, fallback: AccountCapitals): AccountCapitals {
  const out: AccountCapitals = { ...fallback };
  for (const row of ACCOUNTS) {
    const n = num(primary[row.id]);
    if (n > 0) out[row.id] = n;
  }
  return out;
}

function parseSummaries(raw: unknown): AccountSummaries {
  const out: AccountSummaries = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const row = normalizeSummary(value as Record<string, unknown>);
    if (!row) continue;
    if (key.includes("|")) {
      const [account, segment] = key.split("|");
      if (isAccount(account) && isSegment(segment)) {
        out[sliceKey(account, segment)] = { ...row, account, segment };
        continue;
      }
    }
    if (isAccount(key)) out[sliceKey(key, row.segment)] = row;
  }
  return out;
}

function normalizeSummary(raw: Record<string, unknown>): PnlSummary | null {
  if (typeof raw.file !== "string") return null;
  return {
    account: isAccount(raw.account) ? raw.account : "zerodha-tr8076",
    segment: isSegment(raw.segment) ? raw.segment : inferSegment(raw.segment),
    from: typeof raw.from === "string" ? raw.from : "",
    to: typeof raw.to === "string" ? raw.to : "",
    charges: num(raw.charges),
    otherCreditDebit: num(raw.otherCreditDebit),
    realizedPnl: num(raw.realizedPnl),
    unrealizedPnl: num(raw.unrealizedPnl),
    file: raw.file,
  };
}

export function loadPositionBook(): PositionBook {
  if (typeof window === "undefined") return emptyPositionBook();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyPositionBook();
    return parsePositionBook(JSON.parse(raw) as unknown);
  } catch {
    return emptyPositionBook();
  }
}

export function savePositionBook(book: PositionBook) {
  window.localStorage.setItem(KEY, JSON.stringify(book));
}

export function mergeFilePositions(existing: PositionLine[], incoming: PositionLine[]) {
  if (!incoming.length) return existing;
  const incomingIds = new Set(incoming.map((row) => row.id));
  const prior = new Map(existing.map((row) => [row.id, row]));
  const keep = existing.filter((row) => !incomingIds.has(row.id));
  const upserted = incoming.map((row) => {
    const old = prior.get(row.id);
    if (!old) return row;
    return {
      ...row,
      buyDate: old.buyDate || row.buyDate,
      sellDate: old.sellDate || row.sellDate,
      notes: old.notes || row.notes,
      source: old.source === "desk" ? "desk" : row.source,
      buyPrice: old.buyPrice || row.buyPrice,
      sellPrice: old.sellPrice || row.sellPrice,
      quantity: old.quantity || row.quantity,
      riskAmount: old.riskAmount || row.riskAmount,
      side: old.side || row.side,
      ...(old.buyPrice || old.sellPrice
        ? {
            buyValue: old.buyPrice ? old.buyValue : row.buyValue,
            sellValue: old.sellPrice ? old.sellValue : row.sellValue,
            realizedPnl: old.buyPrice || old.sellPrice ? old.realizedPnl : row.realizedPnl,
            realizedPnlPct: old.buyPrice || old.sellPrice ? old.realizedPnlPct : row.realizedPnlPct,
          }
        : {}),
    };
  });
  return [...keep, ...upserted];
}

export function mergeSummaries(
  existing: AccountSummaries,
  incoming: PnlSummary | null,
  _incomingRows: PositionLine[] = [],
  merged: PositionLine[] = [],
): AccountSummaries {
  if (!incoming) return { ...existing };
  const key = sliceKey(incoming.account, incoming.segment);
  const prev = existing[key];
  const slice = merged.filter((row) => sliceKey(row.account, row.segment) === key);
  const realized = slice.length
    ? slice.reduce((sum, row) => sum + row.realizedPnl, 0)
    : incoming.realizedPnl;
  const files = [prev?.file, incoming.file]
    .filter((name, i, all) => Boolean(name) && all.indexOf(name) === i) as string[];
  const alreadyCounted = Boolean(prev?.file && incoming.file && prev.file.includes(incoming.file));
  const froms = [prev?.from, incoming.from].filter(Boolean).sort();
  const tos = [prev?.to, incoming.to].filter(Boolean).sort();

  if (!prev) {
    return { ...existing, [key]: { ...incoming, realizedPnl: realized, unrealizedPnl: 0 } };
  }

  if (alreadyCounted) {
    return {
      ...existing,
      [key]: {
        ...incoming,
        from: froms[0] ?? incoming.from,
        to: tos[tos.length - 1] ?? incoming.to,
        charges: incoming.charges || prev.charges,
        otherCreditDebit: incoming.otherCreditDebit || prev.otherCreditDebit,
        realizedPnl: realized,
        unrealizedPnl: 0,
        file: prev.file,
      },
    };
  }

  return {
    ...existing,
    [key]: {
      account: incoming.account,
      segment: incoming.segment,
      from: froms[0] ?? "",
      to: tos[tos.length - 1] ?? "",
      charges: prev.charges + incoming.charges,
      otherCreditDebit: prev.otherCreditDebit + incoming.otherCreditDebit,
      realizedPnl: realized,
      unrealizedPnl: 0,
      file: files.join(" · "),
    },
  };
}

export function buyAvg(row: PositionLine) {
  return row.buyPrice || (row.quantity ? row.buyValue / row.quantity : 0);
}

export function sellAvg(row: PositionLine) {
  return row.sellPrice || (row.quantity ? row.sellValue / row.quantity : 0);
}

export function applyTradePrices(row: PositionLine, buyPrice: number, sellPrice: number): PositionLine {
  const buyValue = buyPrice > 0 && row.quantity ? buyPrice * row.quantity : row.buyValue;
  const sellValue = sellPrice > 0 && row.quantity ? sellPrice * row.quantity : row.sellValue;
  const realizedPnl = sellValue - buyValue;
  return {
    ...row,
    buyPrice: buyPrice > 0 ? buyPrice : row.buyPrice,
    sellPrice: sellPrice > 0 ? sellPrice : row.sellPrice,
    buyValue,
    sellValue,
    realizedPnl,
    realizedPnlPct: buyValue ? (realizedPnl / buyValue) * 100 : 0,
  };
}

export function holdingDays(
  row: Pick<PositionLine, "buyDate" | "sellDate" | "side" | "openQtyType" | "openQty">,
) {
  const open = entryDate(row);
  const close = exitDate(row);
  if (!open || !close) return null;
  const a = Date.parse(open);
  const b = Date.parse(close);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** Realized P&L divided by rupees you were willing to lose. */
export function riskRewardRatio(realizedPnl: number, riskAmount: number) {
  if (!(riskAmount > 0)) return null;
  return realizedPnl / riskAmount;
}

export { accountLabel, segmentLabel };
