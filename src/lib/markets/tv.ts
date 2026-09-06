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

export function findListing(listings: Listing[], raw: string) {
  const key = decodeURIComponent(raw).trim().toUpperCase();
  return listings.find((l) => l.symbol.toUpperCase() === key) ?? null;
}
