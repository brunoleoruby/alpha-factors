import type { ExchangeId, Listing } from "./types";

const NYSE = new Set(["JPM", "XOM", "UNH", "PFE", "BA", "DIS"]);

export function tradingViewSymbol(symbol: string, locale: ExchangeId) {
  if (locale === "NSE") return `NSE:${symbol}`;
  return `${NYSE.has(symbol) ? "NYSE" : "NASDAQ"}:${symbol}`;
}

export function chartPath(symbol: string, locale: ExchangeId) {
  const slug = encodeURIComponent(symbol);
  return locale === "NSE" ? `/nse/stocks/${slug}` : `/stocks/${slug}`;
}

export type TimeframeId = "15m" | "1h" | "1D" | "1W" | "1M";

export const TIMEFRAMES: {
  id: TimeframeId;
  label: string;
  interval: string;
  range: string;
}[] = [
  { id: "15m", label: "15m", interval: "15m", range: "60d" },
  { id: "1h", label: "1H", interval: "60m", range: "60d" },
  { id: "1D", label: "1D", interval: "1d", range: "2y" },
  { id: "1W", label: "1W", interval: "1wk", range: "5y" },
  { id: "1M", label: "1M", interval: "1mo", range: "10y" },
];

export function timeframeById(id: string) {
  return TIMEFRAMES.find((t) => t.id === id) ?? TIMEFRAMES[2];
}

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export function yahooSymbol(symbol: string, locale: ExchangeId) {
  if (locale === "NSE") return `${symbol}.NS`;
  return symbol;
}

export function findListing(listings: Listing[], raw: string) {
  const key = decodeURIComponent(raw).trim().toUpperCase();
  return listings.find((l) => l.symbol.toUpperCase() === key) ?? null;
}
