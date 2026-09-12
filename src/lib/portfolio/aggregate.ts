import { tradeNotional, type Trade, type TradeAccount, type TradeSegment } from "./trades";

export type StockRollup = {
  key: string;
  symbol: string;
  isin: string;
  exchange: string;
  series: string;
  venueSegment: string;
  account: TradeAccount;
  segment: TradeSegment;
  buyQty: number;
  sellQty: number;
  buyNotional: number;
  sellNotional: number;
  netQty: number;
  fillCount: number;
  ids: string[];
  firstDate: string;
  lastDate: string;
  fills: Trade[];
};

function rollupKey(trade: Trade) {
  return `${trade.account}|${trade.segment}|${trade.symbol}`;
}

export function rollupByStock(trades: Trade[]): StockRollup[] {
  const map = new Map<string, StockRollup>();
  for (const trade of trades) {
    const key = rollupKey(trade);
    let row = map.get(key);
    if (!row) {
      row = {
        key,
        symbol: trade.symbol,
        isin: trade.isin,
        exchange: trade.exchange,
        series: trade.series,
        venueSegment: trade.venueSegment,
        account: trade.account,
        segment: trade.segment,
        buyQty: 0,
        sellQty: 0,
        buyNotional: 0,
        sellNotional: 0,
        netQty: 0,
        fillCount: 0,
        ids: [],
        firstDate: trade.date,
        lastDate: trade.date,
        fills: [],
      };
      map.set(key, row);
    }
    const notional = trade.qty * trade.price;
    if (trade.side === "Buy") {
      row.buyQty += trade.qty;
      row.buyNotional += notional;
    } else {
      row.sellQty += trade.qty;
      row.sellNotional += notional;
    }
    if (trade.date < row.firstDate) row.firstDate = trade.date;
    if (trade.date > row.lastDate) row.lastDate = trade.date;
    if (!row.isin && trade.isin) row.isin = trade.isin;
    if (!row.exchange && trade.exchange) row.exchange = trade.exchange;
    if (!row.series && trade.series) row.series = trade.series;
    row.fillCount += 1;
    row.ids.push(trade.id);
    row.fills.push(trade);
  }

  const rows = [...map.values()].map((row) => ({
    ...row,
    netQty: row.buyQty - row.sellQty,
    fills: [...row.fills].sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate) return byDate;
      return a.executedAt.localeCompare(b.executedAt);
    }),
  }));

  return rows.sort((a, b) => Math.abs(b.netQty) - Math.abs(a.netQty) || a.symbol.localeCompare(b.symbol));
}

export function rollupBuyAvg(row: StockRollup) {
  return row.buyQty ? row.buyNotional / row.buyQty : 0;
}

export function rollupSellAvg(row: StockRollup) {
  return row.sellQty ? row.sellNotional / row.sellQty : 0;
}

export function rollupTurnover(row: StockRollup) {
  return row.buyNotional + row.sellNotional;
}

export function rollupNetNotional(row: StockRollup) {
  return row.fills.reduce((sum, fill) => sum + tradeNotional(fill), 0);
}
