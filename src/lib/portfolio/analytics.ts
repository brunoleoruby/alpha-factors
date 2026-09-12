import { formatInrFine } from "@/lib/format";
import { notionalCost } from "@/lib/research/costs";
import {
  buyAvg,
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
    const day = row.sellDate || row.to;
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
    return [{ date: points[0].date, equity: 0 }, points[0]];
  }
  if (points[0].equity !== 0 && start && points[0].date !== start) {
    return [{ date: start, equity: 0 }, ...points];
  }
  if (points[0].equity !== 0) {
    return [{ date: points[0].date, equity: 0 }, ...points];
  }
  return points;
}
