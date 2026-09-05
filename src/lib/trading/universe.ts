import type { FactorId, FactorWeights, Instrument, StrategyConfig } from "./types";

export const UNIVERSE: Instrument[] = [
  { symbol: "NVDA", name: "NVIDIA", sector: "Tech", startPrice: 118, dna: { value: -0.8, quality: 1.4, vol: 1.6, momentumBias: 1.2, liquidity: 1.5 } },
  { symbol: "AAPL", name: "Apple", sector: "Tech", startPrice: 226, dna: { value: 0.1, quality: 1.6, vol: 0.7, momentumBias: 0.4, liquidity: 1.6 } },
  { symbol: "MSFT", name: "Microsoft", sector: "Tech", startPrice: 415, dna: { value: 0.0, quality: 1.5, vol: 0.6, momentumBias: 0.5, liquidity: 1.5 } },
  { symbol: "GOOGL", name: "Alphabet", sector: "Tech", startPrice: 168, dna: { value: 0.4, quality: 1.2, vol: 0.8, momentumBias: 0.3, liquidity: 1.3 } },
  { symbol: "AMZN", name: "Amazon", sector: "Consumer", startPrice: 186, dna: { value: -0.2, quality: 0.8, vol: 1.0, momentumBias: 0.6, liquidity: 1.4 } },
  { symbol: "META", name: "Meta", sector: "Tech", startPrice: 512, dna: { value: 0.2, quality: 1.3, vol: 1.2, momentumBias: 0.7, liquidity: 1.2 } },
  { symbol: "AVGO", name: "Broadcom", sector: "Tech", startPrice: 172, dna: { value: -0.1, quality: 1.1, vol: 1.3, momentumBias: 0.9, liquidity: 1.0 } },
  { symbol: "JPM", name: "JPMorgan", sector: "Financials", startPrice: 212, dna: { value: 0.7, quality: 0.9, vol: 0.8, momentumBias: 0.2, liquidity: 1.2 } },
  { symbol: "V", name: "Visa", sector: "Financials", startPrice: 278, dna: { value: -0.3, quality: 1.4, vol: 0.5, momentumBias: 0.3, liquidity: 1.1 } },
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy", startPrice: 118, dna: { value: 1.2, quality: 0.6, vol: 0.9, momentumBias: -0.2, liquidity: 1.0 } },
  { symbol: "CVX", name: "Chevron", sector: "Energy", startPrice: 156, dna: { value: 1.1, quality: 0.5, vol: 0.8, momentumBias: -0.3, liquidity: 0.8 } },
  { symbol: "UNH", name: "UnitedHealth", sector: "Health", startPrice: 542, dna: { value: 0.3, quality: 1.0, vol: 0.7, momentumBias: -0.1, liquidity: 0.9 } },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Health", startPrice: 162, dna: { value: 0.8, quality: 1.1, vol: 0.4, momentumBias: -0.2, liquidity: 1.0 } },
  { symbol: "PFE", name: "Pfizer", sector: "Health", startPrice: 28, dna: { value: 1.4, quality: 0.2, vol: 0.9, momentumBias: -0.8, liquidity: 1.1 } },
  { symbol: "KO", name: "Coca-Cola", sector: "Consumer", startPrice: 64, dna: { value: 0.6, quality: 1.0, vol: 0.3, momentumBias: 0.0, liquidity: 0.9 } },
  { symbol: "PG", name: "Procter & Gamble", sector: "Consumer", startPrice: 168, dna: { value: 0.4, quality: 1.2, vol: 0.3, momentumBias: 0.1, liquidity: 0.9 } },
  { symbol: "WMT", name: "Walmart", sector: "Consumer", startPrice: 78, dna: { value: 0.2, quality: 0.9, vol: 0.4, momentumBias: 0.4, liquidity: 1.1 } },
  { symbol: "HD", name: "Home Depot", sector: "Consumer", startPrice: 392, dna: { value: 0.1, quality: 1.0, vol: 0.6, momentumBias: 0.2, liquidity: 0.8 } },
  { symbol: "CAT", name: "Caterpillar", sector: "Industrials", startPrice: 348, dna: { value: 0.5, quality: 0.8, vol: 1.0, momentumBias: 0.3, liquidity: 0.7 } },
  { symbol: "BA", name: "Boeing", sector: "Industrials", startPrice: 178, dna: { value: -0.4, quality: -0.6, vol: 1.5, momentumBias: -0.4, liquidity: 0.8 } },
  { symbol: "DIS", name: "Disney", sector: "Communication", startPrice: 98, dna: { value: 0.3, quality: 0.1, vol: 1.1, momentumBias: -0.3, liquidity: 0.9 } },
  { symbol: "NFLX", name: "Netflix", sector: "Communication", startPrice: 712, dna: { value: -0.6, quality: 0.9, vol: 1.4, momentumBias: 0.8, liquidity: 1.0 } },
  { symbol: "AMD", name: "AMD", sector: "Tech", startPrice: 142, dna: { value: -0.5, quality: 0.4, vol: 1.8, momentumBias: 0.6, liquidity: 1.2 } },
  { symbol: "INTC", name: "Intel", sector: "Tech", startPrice: 22, dna: { value: 1.3, quality: -0.5, vol: 1.7, momentumBias: -0.9, liquidity: 1.3 } },
];

export const FACTOR_META: Record<
  FactorId,
  { label: string; short: string; description: string }
> = {
  momentum: {
    label: "Momentum",
    short: "MOM",
    description: "21-day and 63-day total return. Favors names that have already been rising.",
  },
  meanReversion: {
    label: "Mean reversion",
    short: "REV",
    description: "Distance below the 20-day average. Favors recent losers expected to bounce.",
  },
  lowVol: {
    label: "Low volatility",
    short: "VOL",
    description: "Negative 21-day realized volatility. Favors calmer names.",
  },
  value: {
    label: "Value",
    short: "VAL",
    description: "Earnings yield from simulated fundamentals. Favors cheaper cash earnings.",
  },
  quality: {
    label: "Quality",
    short: "QLT",
    description: "Return on equity from simulated fundamentals. Favors profitable businesses.",
  },
  liquidity: {
    label: "Liquidity",
    short: "LIQ",
    description: "Average dollar volume. Favors names that are cheaper to trade.",
  },
};

export const DEFAULT_WEIGHTS: FactorWeights = {
  momentum: 30,
  meanReversion: 10,
  lowVol: 15,
  value: 20,
  quality: 20,
  liquidity: 5,
};

export const DEFAULT_STRATEGY: StrategyConfig = {
  capital: 1_000_000,
  longCount: 8,
  shortCount: 4,
  rebalanceEvery: 5,
  costBps: 8,
  weights: DEFAULT_WEIGHTS,
};

export function instrumentMap() {
  return Object.fromEntries(UNIVERSE.map((n) => [n.symbol, n]));
}
