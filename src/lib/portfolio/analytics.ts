import { formatInrFine } from "@/lib/format";
import { notionalCost } from "@/lib/research/costs";
import {
  buyAvg,
  entryDate,
  exitDate,
  type AccountSummaries,
  type PnlSummary,
  type PositionLine,
} from "./positions";
import {
  ACCOUNTS,
  SEGMENTS,
  accountLabel,
  segmentLabel,
  type Trade,
  type TradeAccount,
  type TradeSegment,
} from "./trades";

export type PositionRow = {
  key: string;
  symbol: string;
  account: TradeAccount;
  segment: TradeSegment;
  qty: number;
  avgCost: number;
  lastPrice: number;
  marketValue: number;
  unrealized: number;
  realized: number;
  weight: number;
};

export type DailyPoint = { date: string; realized: number; turnover: number };

export type SliceRow = {
  id: string;
  label: string;
  trades: number;
  turnover: number;
  gross: number;
  realized: number;
  unrealized: number;
  totalPnl: number;
  names: number;
};

export type BookAnalytics = {
  positions: PositionRow[];
  openCount: number;
  names: number;
  longNotional: number;
  shortNotional: number;
  gross: number;
  net: number;
  realized: number;
  unrealized: number;
  totalPnl: number;
  winLots: number;
  loseLots: number;
  winRate: number;
  avgWinner: number;
  avgLoser: number;
  buyCount: number;
  sellCount: number;
  turnover: number;
  topWeight: number;
  daily: DailyPoint[];
  byAccount: SliceRow[];
  bySegment: SliceRow[];
  matrix: { account: TradeAccount; segment: TradeSegment; turnover: number; realized: number; gross: number }[];
  costs: number;
  netPnl: number;
  maxDd: number;
  sharpe: number | null;
  sampleDays: number;
  concentrated: boolean;
};

type Lot = { qty: number; price: number };

type Book = {
  lots: Lot[];
  dir: 1 | -1;
  realized: number;
  lastPrice: number;
  account: TradeAccount;
  segment: TradeSegment;
  symbol: string;
};

function keyOf(trade: Pick<Trade, "account" | "segment" | "symbol">) {
  return `${trade.account}|${trade.segment}|${trade.symbol}`;
}

function chronological(trades: Trade[]) {
  return [...trades].sort((a, b) => a.date.localeCompare(b.date));
}

function closeAgainst(book: Book, qty: number, price: number, closedPnls: number[]) {
  let remaining = qty;
  while (remaining > 1e-12 && book.lots.length) {
    const lot = book.lots[0];
    const take = Math.min(lot.qty, remaining);
    const pnl = book.dir === 1 ? (price - lot.price) * take : (lot.price - price) * take;
    book.realized += pnl;
    closedPnls.push(pnl);
    lot.qty -= take;
    remaining -= take;
    if (lot.qty <= 1e-12) book.lots.shift();
  }
  if (!book.lots.length) book.dir = 1;
  return remaining;
}

function emptySlice(id: string, label: string): SliceRow {
  return { id, label, trades: 0, turnover: 0, gross: 0, realized: 0, unrealized: 0, totalPnl: 0, names: 0 };
}

export function analyzeBook(trades: Trade[]): BookAnalytics {
  const books = new Map<string, Book>();
  const closedPnls: number[] = [];
  const byDate = new Map<string, DailyPoint>();
  let buyCount = 0;
  let sellCount = 0;
  let turnover = 0;

  const accountTrades = new Map<TradeAccount, number>();
  const segmentTrades = new Map<TradeSegment, number>();
  const accountTurnover = new Map<TradeAccount, number>();
  const segmentTurnover = new Map<TradeSegment, number>();

  for (const trade of chronological(trades)) {
    if (trade.side === "Buy") buyCount += 1;
    else sellCount += 1;
    const notional = trade.qty * trade.price;
    turnover += notional;
    accountTrades.set(trade.account, (accountTrades.get(trade.account) ?? 0) + 1);
    segmentTrades.set(trade.segment, (segmentTrades.get(trade.segment) ?? 0) + 1);
    accountTurnover.set(trade.account, (accountTurnover.get(trade.account) ?? 0) + notional);
    segmentTurnover.set(trade.segment, (segmentTurnover.get(trade.segment) ?? 0) + notional);

    const key = keyOf(trade);
    let book = books.get(key);
    if (!book) {
      book = {
        lots: [],
        dir: 1,
        realized: 0,
        lastPrice: trade.price,
        account: trade.account,
        segment: trade.segment,
        symbol: trade.symbol,
      };
      books.set(key, book);
    }

    const incomingDir: 1 | -1 = trade.side === "Buy" ? 1 : -1;
    let qty = trade.qty;
    if (book.lots.length && book.dir !== incomingDir) {
      qty = closeAgainst(book, qty, trade.price, closedPnls);
    }
    if (qty > 1e-12) {
      if (!book.lots.length) book.dir = incomingDir;
      book.lots.push({ qty, price: trade.price });
    }
    book.lastPrice = trade.price;

    const realizedSoFar = [...books.values()].reduce((sum, item) => sum + item.realized, 0);
    const prev = byDate.get(trade.date);
    byDate.set(trade.date, {
      date: trade.date,
      realized: realizedSoFar,
      turnover: (prev?.turnover ?? 0) + notional,
    });
  }

  const raw: Omit<PositionRow, "weight">[] = [];
  for (const [key, book] of books) {
    const qtyAbs = book.lots.reduce((sum, lot) => sum + lot.qty, 0);
    const cost = book.lots.reduce((sum, lot) => sum + lot.qty * lot.price, 0);
    const qty = book.dir * qtyAbs;
    const avgCost = qtyAbs ? cost / qtyAbs : 0;
    raw.push({
      key,
      symbol: book.symbol,
      account: book.account,
      segment: book.segment,
      qty,
      avgCost,
      lastPrice: book.lastPrice,
      marketValue: qty * book.lastPrice,
      unrealized: qtyAbs ? (book.lastPrice - avgCost) * qty : 0,
      realized: book.realized,
    });
  }

  const open = raw.filter((row) => Math.abs(row.qty) > 1e-12);
  const gross = open.reduce((sum, row) => sum + Math.abs(row.marketValue), 0);
  const positions: PositionRow[] = raw
    .map((row) => ({
      ...row,
      weight: gross ? Math.abs(row.marketValue) / gross : 0,
    }))
    .sort((a, b) => Math.abs(b.marketValue) - Math.abs(a.marketValue));

  const longNotional = open.filter((row) => row.qty > 0).reduce((sum, row) => sum + row.marketValue, 0);
  const shortNotional = open.filter((row) => row.qty < 0).reduce((sum, row) => sum + Math.abs(row.marketValue), 0);
  const realized = raw.reduce((sum, row) => sum + row.realized, 0);
  const unrealized = 0;
  const winners = closedPnls.filter((n) => n > 1e-12);
  const losers = closedPnls.filter((n) => n < -1e-12);

  const byAccount = ACCOUNTS.map((account) => {
    const slicePos = raw.filter((row) => row.account === account.id);
    const sliceOpen = slicePos.filter((row) => Math.abs(row.qty) > 1e-12);
    const sliceRealized = slicePos.reduce((sum, row) => sum + row.realized, 0);
    return {
      ...emptySlice(account.id, accountLabel(account.id)),
      trades: accountTrades.get(account.id) ?? 0,
      turnover: accountTurnover.get(account.id) ?? 0,
      gross: sliceOpen.reduce((sum, row) => sum + Math.abs(row.marketValue), 0),
      realized: sliceRealized,
      unrealized: 0,
      totalPnl: sliceRealized,
      names: new Set(sliceOpen.map((row) => row.symbol)).size,
    };
  });

  const bySegment = SEGMENTS.map((segment) => {
    const slicePos = raw.filter((row) => row.segment === segment.id);
    const sliceOpen = slicePos.filter((row) => Math.abs(row.qty) > 1e-12);
    const sliceRealized = slicePos.reduce((sum, row) => sum + row.realized, 0);
    return {
      ...emptySlice(segment.id, segment.label),
      trades: segmentTrades.get(segment.id) ?? 0,
      turnover: segmentTurnover.get(segment.id) ?? 0,
      gross: sliceOpen.reduce((sum, row) => sum + Math.abs(row.marketValue), 0),
      realized: sliceRealized,
      unrealized: 0,
      totalPnl: sliceRealized,
      names: new Set(sliceOpen.map((row) => row.symbol)).size,
    };
  });

  const matrix = ACCOUNTS.flatMap((account) =>
    SEGMENTS.map((segment) => {
      const slicePos = raw.filter((row) => row.account === account.id && row.segment === segment.id);
      const sliceOpen = slicePos.filter((row) => Math.abs(row.qty) > 1e-12);
      return {
        account: account.id,
        segment: segment.id,
        turnover: trades
          .filter((t) => t.account === account.id && t.segment === segment.id)
          .reduce((sum, t) => sum + t.qty * t.price, 0),
        realized: slicePos.reduce((sum, row) => sum + row.realized, 0),
        gross: sliceOpen.reduce((sum, row) => sum + Math.abs(row.marketValue), 0),
      };
    }),
  );

  const costs = notionalCost(turnover);
  const totalPnl = realized;
  const topWeight = positions.find((row) => Math.abs(row.qty) > 1e-12)?.weight ?? 0;
  const path = pathStats(
    [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    gross,
  );

  return {
    positions,
    openCount: open.length,
    names: new Set(open.map((row) => row.symbol)).size,
    longNotional,
    shortNotional,
    gross,
    net: longNotional - shortNotional,
    realized,
    unrealized,
    totalPnl,
    winLots: winners.length,
    loseLots: losers.length,
    winRate: closedPnls.length ? winners.length / closedPnls.length : 0,
    avgWinner: winners.length ? winners.reduce((sum, n) => sum + n, 0) / winners.length : 0,
    avgLoser: losers.length ? losers.reduce((sum, n) => sum + n, 0) / losers.length : 0,
    buyCount,
    sellCount,
    turnover,
    topWeight,
    daily: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    byAccount,
    bySegment,
    matrix,
    costs,
    netPnl: totalPnl - costs,
    maxDd: path.maxDd,
    sharpe: path.sharpe,
    sampleDays: path.days,
    concentrated: topWeight >= 0.5,
  };
}

function pathStats(daily: DailyPoint[], gross: number) {
  let peak = -Infinity;
  let maxDd = 0;
  const rets: number[] = [];
  let prev = 0;
  const scale = gross > 1e-9 ? gross : 1;
  for (const p of daily) {
    if (p.realized > peak) peak = p.realized;
    const dd = p.realized - peak;
    if (dd < maxDd) maxDd = dd;
    rets.push((p.realized - prev) / scale);
    prev = p.realized;
  }
  const n = rets.length;
  if (n < 5) return { maxDd, sharpe: null as number | null, days: n };
  const mean = rets.reduce((s, x) => s + x, 0) / n;
  const varSum = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const std = Math.sqrt(varSum);
  const sharpe = std > 1e-12 ? (mean / std) * Math.sqrt(252) : null;
  return { maxDd, sharpe, days: n };
}

export function analyzePositions(rows: PositionLine[], summary: PnlSummary | null): BookAnalytics {
  const realized = rows.reduce((sum, row) => sum + row.realizedPnl, 0);
  const unrealized = 0;
  const costs = summary?.charges ?? 0;
  const other = summary?.otherCreditDebit ?? 0;
  const turnover = rows.reduce((sum, row) => sum + row.buyValue + row.sellValue, 0);

  const raw: Omit<PositionRow, "weight">[] = rows.map((row) => {
    const short = row.openQtyType.toLowerCase().includes("short") || row.openQty < 0;
    const qtyAbs = Math.abs(row.openQty);
    const qty = short ? -qtyAbs : qtyAbs;
    const avgCost = qtyAbs ? Math.abs(row.openValue) / qtyAbs : buyAvg(row);
    const lastPrice = row.prevClose || avgCost;
    const marketValue = qty !== 0 ? (row.openValue || qty * lastPrice) : 0;
    return {
      key: row.id,
      symbol: row.symbol,
      account: row.account,
      segment: row.segment,
      qty,
      avgCost,
      lastPrice,
      marketValue,
      unrealized: row.unrealizedPnl,
      realized: row.realizedPnl,
    };
  });

  const open = raw.filter((row) => Math.abs(row.qty) > 1e-12);
  const gross = open.reduce((sum, row) => sum + Math.abs(row.marketValue), 0);
  const positions: PositionRow[] = raw
    .map((row) => ({
      ...row,
      weight: gross ? Math.abs(row.marketValue) / gross : 0,
    }))
    .sort((a, b) => Math.abs(b.realized) - Math.abs(a.realized));

  const longNotional = open.filter((row) => row.qty > 0).reduce((sum, row) => sum + row.marketValue, 0);
  const shortNotional = open.filter((row) => row.qty < 0).reduce((sum, row) => sum + Math.abs(row.marketValue), 0);
  const winners = rows.filter((row) => row.realizedPnl > 1e-12);
  const losers = rows.filter((row) => row.realizedPnl < -1e-12);
  const topWeight = positions.find((row) => Math.abs(row.qty) > 1e-12)?.weight ?? 0;

  const accountTrades = new Map<TradeAccount, number>();
  const segmentTrades = new Map<TradeSegment, number>();
  const accountTurnover = new Map<TradeAccount, number>();
  const segmentTurnover = new Map<TradeSegment, number>();
  for (const row of rows) {
    accountTrades.set(row.account, (accountTrades.get(row.account) ?? 0) + 1);
    segmentTrades.set(row.segment, (segmentTrades.get(row.segment) ?? 0) + 1);
    const notion = row.buyValue + row.sellValue;
    accountTurnover.set(row.account, (accountTurnover.get(row.account) ?? 0) + notion);
    segmentTurnover.set(row.segment, (segmentTurnover.get(row.segment) ?? 0) + notion);
  }

  const byAccount = ACCOUNTS.map((account) => {
    const slicePos = raw.filter((row) => row.account === account.id);
    const sliceOpen = slicePos.filter((row) => Math.abs(row.qty) > 1e-12);
    const sliceRealized = slicePos.reduce((sum, row) => sum + row.realized, 0);
    return {
      ...emptySlice(account.id, accountLabel(account.id)),
      trades: accountTrades.get(account.id) ?? 0,
      turnover: accountTurnover.get(account.id) ?? 0,
      gross: sliceOpen.reduce((sum, row) => sum + Math.abs(row.marketValue), 0),
      realized: sliceRealized,
      unrealized: 0,
      totalPnl: sliceRealized,
      names: new Set(sliceOpen.map((row) => row.symbol)).size,
    };
  });

  const bySegment = SEGMENTS.map((segment) => {
    const slicePos = raw.filter((row) => row.segment === segment.id);
    const sliceOpen = slicePos.filter((row) => Math.abs(row.qty) > 1e-12);
    const sliceRealized = slicePos.reduce((sum, row) => sum + row.realized, 0);
    return {
      ...emptySlice(segment.id, segment.label),
      trades: segmentTrades.get(segment.id) ?? 0,
      turnover: segmentTurnover.get(segment.id) ?? 0,
      gross: sliceOpen.reduce((sum, row) => sum + Math.abs(row.marketValue), 0),
      realized: sliceRealized,
      unrealized: 0,
      totalPnl: sliceRealized,
      names: new Set(sliceOpen.map((row) => row.symbol)).size,
    };
  });

  const matrix = ACCOUNTS.flatMap((account) =>
    SEGMENTS.map((segment) => {
      const slicePos = raw.filter((row) => row.account === account.id && row.segment === segment.id);
      const sliceOpen = slicePos.filter((row) => Math.abs(row.qty) > 1e-12);
      return {
        account: account.id,
        segment: segment.id,
        turnover: rows
          .filter((t) => t.account === account.id && t.segment === segment.id)
          .reduce((sum, t) => sum + t.buyValue + t.sellValue, 0),
        realized: slicePos.reduce((sum, row) => sum + row.realized, 0),
        gross: sliceOpen.reduce((sum, row) => sum + Math.abs(row.marketValue), 0),
      };
    }),
  );

  const totalPnl = realized;
  return {
    positions,
    openCount: open.length,
    names: new Set(open.map((row) => row.symbol)).size,
    longNotional,
    shortNotional,
    gross,
    net: longNotional - shortNotional,
    realized,
    unrealized,
    totalPnl,
    winLots: winners.length,
    loseLots: losers.length,
    winRate: rows.length ? winners.length / rows.length : 0,
    avgWinner: winners.length ? winners.reduce((sum, n) => sum + n.realizedPnl, 0) / winners.length : 0,
    avgLoser: losers.length ? losers.reduce((sum, n) => sum + n.realizedPnl, 0) / losers.length : 0,
    buyCount: rows.filter((row) => row.buyValue > 0).length,
    sellCount: rows.filter((row) => row.sellValue > 0).length,
    turnover,
    topWeight,
    daily: [],
    byAccount,
    bySegment,
    matrix,
    costs,
    netPnl: totalPnl + other - costs,
    maxDd: 0,
    sharpe: null,
    sampleDays: 0,
    concentrated: topWeight >= 0.5,
  };
}

export function summaryForView(
  summaries: AccountSummaries,
  accountView: "all" | TradeAccount,
  segmentView: "all" | TradeSegment,
): PnlSummary | null {
  const parts = Object.values(summaries).filter((row) => {
    if (accountView !== "all" && row.account !== accountView) return false;
    if (segmentView !== "all" && row.segment !== segmentView) return false;
    return true;
  });
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  const froms = parts.map((p) => p.from).filter(Boolean).sort();
  const tos = parts.map((p) => p.to).filter(Boolean).sort();
  return {
    account: parts[0].account,
    segment: parts[0].segment,
    from: froms[0] ?? "",
    to: tos[tos.length - 1] ?? "",
    charges: parts.reduce((sum, p) => sum + p.charges, 0),
    otherCreditDebit: parts.reduce((sum, p) => sum + p.otherCreditDebit, 0),
    realizedPnl: parts.reduce((sum, p) => sum + p.realizedPnl, 0),
    unrealizedPnl: 0,
    file: parts.map((p) => p.file).filter(Boolean).join(" · "),
  };
}

export function money(n: number) {
  return formatInrFine(n);
}

export function returnOnCapital(pnl: number, capital: number) {
  if (!(capital > 0)) return null;
  return pnl / capital;
}

export function annualizedOnCapital(roc: number | null, from?: string, to?: string) {
  if (roc == null || !from || !to) return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  const years = (end - start) / (365.25 * 86_400_000);
  if (!(years > 0)) return null;
  return roc / years;
}

export type HitRateBucket = {
  id: string;
  label: string;
  names: number;
  hits: number;
  misses: number;
  realized: number;
  hitRate: number | null;
};

export type HitRateBook = {
  months: HitRateBucket[];
  quarters: HitRateBucket[];
  names: number;
  dated: number;
  hits: number;
  misses: number;
  hitRate: number | null;
};

const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseBookDay(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]) };
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return { y: Number(dmy[3]), m: Number(dmy[2]) };
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function fyQuarter(year: number, month: number) {
  if (month >= 4) return { fy: year + 1, q: Math.floor((month - 4) / 3) + 1 };
  return { fy: year, q: 4 };
}

function periodKeys(day: { y: number; m: number }) {
  const monthId = `${day.y}-${String(day.m).padStart(2, "0")}`;
  const monthLabel = `${MONTH_LABEL[day.m - 1]} ${day.y}`;
  const fy = fyQuarter(day.y, day.m);
  const qid = `${fy.fy}-Q${fy.q}`;
  const startMonth = fy.q === 4 ? 1 : (fy.q - 1) * 3 + 4;
  const endMonth = startMonth + 2;
  const qLabel = `FY${String(fy.fy).slice(-2)} Q${fy.q} · ${MONTH_LABEL[startMonth - 1]}–${MONTH_LABEL[endMonth - 1]}`;
  const yearId = `FY${fy.fy}`;
  const yearLabel = `FY${String(fy.fy).slice(-2)} · Apr–Mar`;
  return { monthId, monthLabel, qid, qLabel, yearId, yearLabel };
}

function emptyHitBucket(id: string, label: string): HitRateBucket {
  return { id, label, names: 0, hits: 0, misses: 0, realized: 0, hitRate: null };
}

function finishHitBucket(row: HitRateBucket): HitRateBucket {
  const scored = row.hits + row.misses;
  return { ...row, hitRate: scored ? row.hits / scored : null };
}

function addHit(row: HitRateBucket, pnl: number) {
  row.names += 1;
  row.realized += pnl;
  if (pnl > 1e-12) row.hits += 1;
  else if (pnl < -1e-12) row.misses += 1;
}

/** Hit rate by entry date (buy for long, sell for short). Indian FY quarter (April start). */
export function hitRateByBuyDate(rows: PositionLine[]): HitRateBook {
  const months = new Map<string, HitRateBucket>();
  const quarters = new Map<string, HitRateBucket>();
  let dated = 0;
  let hits = 0;
  let misses = 0;

  for (const row of rows) {
    const day = parseBookDay(entryDate(row));
    if (!day || day.m < 1 || day.m > 12) continue;
    dated += 1;
    if (row.realizedPnl > 1e-12) hits += 1;
    else if (row.realizedPnl < -1e-12) misses += 1;

    const { monthId, monthLabel, qid, qLabel } = periodKeys(day);
    const month = months.get(monthId) ?? emptyHitBucket(monthId, monthLabel);
    addHit(month, row.realizedPnl);
    months.set(monthId, month);

    const quarter = quarters.get(qid) ?? emptyHitBucket(qid, qLabel);
    addHit(quarter, row.realizedPnl);
    quarters.set(qid, quarter);
  }

  const scored = hits + misses;
  return {
    months: [...months.values()].sort((a, b) => a.id.localeCompare(b.id)).map(finishHitBucket),
    quarters: [...quarters.values()].sort((a, b) => a.id.localeCompare(b.id)).map(finishHitBucket),
    names: rows.length,
    dated,
    hits,
    misses,
    hitRate: scored ? hits / scored : null,
  };
}

export type ProfitBucket = {
  id: string;
  label: string;
  names: number;
  realized: number;
};

export type ProfitBook = {
  months: ProfitBucket[];
  quarters: ProfitBucket[];
  years: ProfitBucket[];
  names: number;
  dated: number;
  realized: number;
};

function emptyProfitBucket(id: string, label: string): ProfitBucket {
  return { id, label, names: 0, realized: 0 };
}

/** Realized P&L by exit date (sell for long, buy/cover for short). Indian FY quarter (April start). */
export function profitBySellDate(rows: PositionLine[]): ProfitBook {
  const months = new Map<string, ProfitBucket>();
  const quarters = new Map<string, ProfitBucket>();
  const years = new Map<string, ProfitBucket>();
  let dated = 0;
  let realized = 0;

  for (const row of rows) {
    const day = parseBookDay(exitDate(row));
    if (!day || day.m < 1 || day.m > 12) continue;
    dated += 1;
    realized += row.realizedPnl;

    const { monthId, monthLabel, qid, qLabel, yearId, yearLabel } = periodKeys(day);
    const month = months.get(monthId) ?? emptyProfitBucket(monthId, monthLabel);
    month.names += 1;
    month.realized += row.realizedPnl;
    months.set(monthId, month);

    const quarter = quarters.get(qid) ?? emptyProfitBucket(qid, qLabel);
    quarter.names += 1;
    quarter.realized += row.realizedPnl;
    quarters.set(qid, quarter);

    const year = years.get(yearId) ?? emptyProfitBucket(yearId, yearLabel);
    year.names += 1;
    year.realized += row.realizedPnl;
    years.set(yearId, year);
  }

  return {
    months: [...months.values()].sort((a, b) => a.id.localeCompare(b.id)),
    quarters: [...quarters.values()].sort((a, b) => a.id.localeCompare(b.id)),
    years: [...years.values()].sort((a, b) => a.id.localeCompare(b.id)),
    names: rows.length,
    dated,
    realized,
  };
}

export type CurvePoint = { date: string; equity: number };

export function portfolioCurve(rows: PositionLine[], summary: PnlSummary | null): CurvePoint[] {
  const byDay = new Map<string, number>();
  const bump = (date: string, amount: number) => {
    const day = date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    byDay.set(day, (byDay.get(day) ?? 0) + amount);
  };

  let undated = 0;
  for (const row of rows) {
    const day = exitDate(row) || row.to;
    if (day) bump(day, row.realizedPnl);
    else undated += row.realizedPnl;
  }

  const start = (summary?.from || [...byDay.keys()].sort()[0] || "").slice(0, 10);
  const end = (summary?.to || [...byDay.keys()].sort().at(-1) || "").slice(0, 10);
  if (undated) bump(end || start, undated);
  const last = [...byDay.keys()].sort().at(-1) || end || start;
  if (last) bump(last, (summary?.otherCreditDebit ?? 0) - (summary?.charges ?? 0));
  if (start) bump(start, 0);

  const dates = [...byDay.keys()].sort();
  if (!dates.length) return [];
  let run = 0;
  const points = dates.map((date) => {
    run += byDay.get(date) ?? 0;
    return { date, equity: run };
  });
  if (points.length === 1) {
    const day = points[0].date;
    const prior = new Date(`${day}T00:00:00Z`);
    prior.setUTCDate(prior.getUTCDate() - 1);
    return [{ date: prior.toISOString().slice(0, 10), equity: 0 }, points[0]];
  }
  if (points[0].equity !== 0 && start && points[0].date !== start) {
    return [{ date: start, equity: 0 }, ...points];
  }
  if (points[0].equity !== 0) {
    return [{ date: points[0].date, equity: 0 }, ...points];
  }
  return points;
}
