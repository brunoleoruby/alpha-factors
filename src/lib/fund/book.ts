export type FundPosition = {
  symbol: string;
  name: string;
  side: "Long" | "Short";
  weight: number;
  pnl: number;
  sector: string;
};

export type NavPoint = { date: string; equity: number };

export const FUND = {
  name: "Eminent Corpus",
  vehicle: "Long / Short Equity",
  asOf: "2026-09-09",
  aum: 482_000_000,
  nav: 1284.62,
  mtd: 0.0184,
  ytd: 0.1126,
  itd: 0.384,
  sharpe: 1.42,
  vol: 0.094,
  maxDd: -0.062,
  gross: 1.48,
  net: 0.36,
  cash: 0.08,
} as const;

export const NAV_SERIES: NavPoint[] = [
  { date: "2026-01-02", equity: 1154 },
  { date: "2026-01-31", equity: 1168 },
  { date: "2026-02-28", equity: 1151 },
  { date: "2026-03-31", equity: 1189 },
  { date: "2026-04-30", equity: 1204 },
  { date: "2026-05-30", equity: 1196 },
  { date: "2026-06-30", equity: 1231 },
  { date: "2026-07-31", equity: 1248 },
  { date: "2026-08-29", equity: 1261 },
  { date: "2026-09-09", equity: 1284.62 },
];

export const POSITIONS: FundPosition[] = [
  { symbol: "MSFT", name: "Microsoft", side: "Long", weight: 0.084, pnl: 0.021, sector: "Software" },
  { symbol: "NVDA", name: "NVIDIA", side: "Long", weight: 0.072, pnl: 0.038, sector: "Semis" },
  { symbol: "AMZN", name: "Amazon", side: "Long", weight: 0.061, pnl: 0.014, sector: "Consumer" },
  { symbol: "JPM", name: "JPMorgan", side: "Long", weight: 0.048, pnl: 0.009, sector: "Financials" },
  { symbol: "UNH", name: "UnitedHealth", side: "Short", weight: -0.032, pnl: 0.006, sector: "Health" },
  { symbol: "BA", name: "Boeing", side: "Short", weight: -0.028, pnl: -0.011, sector: "Industrials" },
  { symbol: "XOM", name: "Exxon Mobil", side: "Long", weight: 0.041, pnl: -0.004, sector: "Energy" },
  { symbol: "TSM", name: "TSMC", side: "Long", weight: 0.055, pnl: 0.017, sector: "Semis" },
];

export const SLEEVES = [
  { label: "US large cap", weight: 0.46 },
  { label: "Global cyclicals", weight: 0.22 },
  { label: "Short book", weight: 0.18 },
  { label: "Cash & hedges", weight: 0.14 },
] as const;

export const RISK_NOTES = [
  { label: "Beta to S&P 500", value: "0.31" },
  { label: "Avg. holding", value: "38 days" },
  { label: "Names", value: "42 / 18 L-S" },
  { label: "Top 10", value: "41% of NAV" },
] as const;
