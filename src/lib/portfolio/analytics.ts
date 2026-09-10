import { formatInrFine } from "@/lib/format";
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
  const unrealized = open.reduce((sum, row) => sum + row.unrealized, 0);
  const winners = closedPnls.filter((n) => n > 1e-12);
  const losers = closedPnls.filter((n) => n < -1e-12);

  const byAccount = ACCOUNTS.map((account) => {
    const slicePos = raw.filter((row) => row.account === account.id);
    const sliceOpen = slicePos.filter((row) => Math.abs(row.qty) > 1e-12);
    const sliceRealized = slicePos.reduce((sum, row) => sum + row.realized, 0);
    const sliceUnreal = sliceOpen.reduce((sum, row) => sum + row.unrealized, 0);
    return {
      ...emptySlice(account.id, accountLabel(account.id)),
      trades: accountTrades.get(account.id) ?? 0,
      turnover: accountTurnover.get(account.id) ?? 0,
      gross: sliceOpen.reduce((sum, row) => sum + Math.abs(row.marketValue), 0),
      realized: sliceRealized,
      unrealized: sliceUnreal,
      totalPnl: sliceRealized + sliceUnreal,
      names: new Set(sliceOpen.map((row) => row.symbol)).size,
    };
  });

  const bySegment = SEGMENTS.map((segment) => {
    const slicePos = raw.filter((row) => row.segment === segment.id);
    const sliceOpen = slicePos.filter((row) => Math.abs(row.qty) > 1e-12);
    const sliceRealized = slicePos.reduce((sum, row) => sum + row.realized, 0);
    const sliceUnreal = sliceOpen.reduce((sum, row) => sum + row.unrealized, 0);
    return {
      ...emptySlice(segment.id, segment.label),
      trades: segmentTrades.get(segment.id) ?? 0,
      turnover: segmentTurnover.get(segment.id) ?? 0,
      gross: sliceOpen.reduce((sum, row) => sum + Math.abs(row.marketValue), 0),
      realized: sliceRealized,
      unrealized: sliceUnreal,
      totalPnl: sliceRealized + sliceUnreal,
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
    totalPnl: realized + unrealized,
    winLots: winners.length,
    loseLots: losers.length,
    winRate: closedPnls.length ? winners.length / closedPnls.length : 0,
    avgWinner: winners.length ? winners.reduce((sum, n) => sum + n, 0) / winners.length : 0,
    avgLoser: losers.length ? losers.reduce((sum, n) => sum + n, 0) / losers.length : 0,
    buyCount,
    sellCount,
    turnover,
    topWeight: positions.find((row) => Math.abs(row.qty) > 1e-12)?.weight ?? 0,
    daily: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    byAccount,
    bySegment,
    matrix,
  };
}

export function money(n: number) {
  return formatInrFine(n);
}
