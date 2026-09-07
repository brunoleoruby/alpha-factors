export type EnvColumnId = "india" | "usa" | "asia" | "commodity" | "currency" | "crude";

export type EnvInstrument = {
  id: string;
  yahoo: string;
  name: string;
  short: string;
  digits: number;
};

export type EnvColumn = {
  id: EnvColumnId;
  title: string;
  blurb: string;
  rows: EnvInstrument[];
};

export const ENV_COLUMNS: EnvColumn[] = [
  {
    id: "india",
    title: "Indian indices",
    blurb: "NSE cash-market tape.",
    rows: [
      { id: "nifty", yahoo: "^NSEI", name: "Nifty 50", short: "NIFTY", digits: 2 },
      { id: "smallcap", yahoo: "NIFTY_SMLCAP_100.NS", name: "Nifty Smallcap 100", short: "SMLCAP", digits: 2 },
      { id: "midcap", yahoo: "NIFTY_MIDCAP_100.NS", name: "Nifty Midcap 100", short: "MIDCAP", digits: 2 },
      { id: "banknifty", yahoo: "^NSEBANK", name: "Bank Nifty", short: "BANKNIFTY", digits: 2 },
      { id: "indiavix", yahoo: "^INDIAVIX", name: "India VIX", short: "INDIA VIX", digits: 2 },
    ],
  },
  {
    id: "usa",
    title: "USA indices",
    blurb: "US cash indices and vol.",
    rows: [
      { id: "spx", yahoo: "^GSPC", name: "S&P 500", short: "SPX", digits: 2 },
      { id: "ndx", yahoo: "^NDX", name: "Nasdaq 100", short: "NDX", digits: 2 },
      { id: "dji", yahoo: "^DJI", name: "Dow Jones", short: "DJI", digits: 2 },
      { id: "rut", yahoo: "^RUT", name: "Russell 2000", short: "RUT", digits: 2 },
      { id: "vix", yahoo: "^VIX", name: "Cboe VIX", short: "VIX", digits: 2 },
    ],
  },
  {
    id: "asia",
    title: "Asia indices",
    blurb: "Overnight Asia session.",
    rows: [
      { id: "n225", yahoo: "^N225", name: "Nikkei 225", short: "NKY", digits: 2 },
      { id: "hsi", yahoo: "^HSI", name: "Hang Seng", short: "HSI", digits: 2 },
      { id: "shcomp", yahoo: "000001.SS", name: "Shanghai Composite", short: "SHCOMP", digits: 2 },
      { id: "kospi", yahoo: "^KS11", name: "KOSPI", short: "KOSPI", digits: 2 },
      { id: "twii", yahoo: "^TWII", name: "Taiwan Weighted", short: "TWII", digits: 2 },
      { id: "asx", yahoo: "^AXJO", name: "ASX 200", short: "ASX", digits: 2 },
    ],
  },
  {
    id: "commodity",
    title: "Commodity",
    blurb: "Metals and gas. Crude is its own column.",
    rows: [
      { id: "gold", yahoo: "GC=F", name: "Gold", short: "GC", digits: 2 },
      { id: "silver", yahoo: "SI=F", name: "Silver", short: "SI", digits: 3 },
      { id: "copper", yahoo: "HG=F", name: "Copper", short: "HG", digits: 4 },
      { id: "natgas", yahoo: "NG=F", name: "Natural gas", short: "NG", digits: 3 },
    ],
  },
  {
    id: "currency",
    title: "Currency",
    blurb: "Rupee, dollar, and G10.",
    rows: [
      { id: "usdinr", yahoo: "INR=X", name: "USD / INR", short: "USDINR", digits: 4 },
      { id: "dxy", yahoo: "DX-Y.NYB", name: "US Dollar Index", short: "DXY", digits: 3 },
      { id: "eurusd", yahoo: "EURUSD=X", name: "EUR / USD", short: "EURUSD", digits: 5 },
      { id: "usdjpy", yahoo: "JPY=X", name: "USD / JPY", short: "USDJPY", digits: 3 },
      { id: "gbpinr", yahoo: "GBPINR=X", name: "GBP / INR", short: "GBPINR", digits: 4 },
    ],
  },
  {
    id: "crude",
    title: "Crude oil",
    blurb: "WTI and Brent, not mixed into metals.",
    rows: [
      { id: "wti", yahoo: "CL=F", name: "WTI crude", short: "CL", digits: 2 },
      { id: "brent", yahoo: "BZ=F", name: "Brent crude", short: "BZ", digits: 2 },
    ],
  },
];

export const ENV_YAHOO_SYMBOLS = ENV_COLUMNS.flatMap((c) => c.rows.map((r) => r.yahoo));

export const ENV_BY_YAHOO = Object.fromEntries(
  ENV_COLUMNS.flatMap((c) => c.rows.map((r) => [r.yahoo, { column: c.id, instrument: r }])),
) as Record<string, { column: EnvColumnId; instrument: EnvInstrument }>;

export type EnvQuote = {
  id: string;
  yahoo: string;
  last: number | null;
  change: number | null;
  changePct: number | null;
  error?: string;
};

export function envYahooAllowlist() {
  return new Set(ENV_YAHOO_SYMBOLS);
}
