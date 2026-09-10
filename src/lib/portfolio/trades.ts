export type TradeSide = "Buy" | "Sell";

export type TradeAccount = "zerodha-tr8076" | "zerodha-vfh197" | "fyers";
export type TradeSegment = "equity" | "nifty50" | "commodity";

export const ACCOUNTS: { id: TradeAccount; label: string; broker: string }[] = [
  { id: "zerodha-tr8076", label: "TR8076", broker: "Zerodha" },
  { id: "zerodha-vfh197", label: "VFH197", broker: "Zerodha" },
  { id: "fyers", label: "Fyers", broker: "Fyers" },
];

export const SEGMENTS: { id: TradeSegment; label: string }[] = [
  { id: "equity", label: "Equity" },
  { id: "nifty50", label: "Nifty 50" },
  { id: "commodity", label: "Commodity" },
];

export type Trade = {
  id: string;
  date: string;
  symbol: string;
  side: TradeSide;
  qty: number;
  price: number;
  account: TradeAccount;
  segment: TradeSegment;
  notes: string;
};

const KEY = "alpha-factors.trades.v2";
const LEGACY_KEY = "alpha-factors.trades.v1";

export function accountLabel(id: TradeAccount) {
  const row = ACCOUNTS.find((a) => a.id === id);
  return row ? `${row.broker} ${row.label}` : id;
}

export function segmentLabel(id: TradeSegment) {
  return SEGMENTS.find((s) => s.id === id)?.label ?? id;
}

function isAccount(value: unknown): value is TradeAccount {
  return ACCOUNTS.some((a) => a.id === value);
}

function isSegment(value: unknown): value is TradeSegment {
  return SEGMENTS.some((s) => s.id === value);
}

export function emptyTradeForm(): Omit<Trade, "id"> {
  return {
    date: new Date().toISOString().slice(0, 10),
    symbol: "",
    side: "Buy",
    qty: 0,
    price: 0,
    account: "zerodha-tr8076",
    segment: "equity",
    notes: "",
  };
}

function normalize(raw: Record<string, unknown>): Trade | null {
  if (typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    date: typeof raw.date === "string" ? raw.date : emptyTradeForm().date,
    symbol: typeof raw.symbol === "string" ? raw.symbol : "",
    side: raw.side === "Sell" ? "Sell" : "Buy",
    qty: Number(raw.qty) || 0,
    price: Number(raw.price) || 0,
    account: isAccount(raw.account) ? raw.account : "zerodha-tr8076",
    segment: isSegment(raw.segment) ? raw.segment : "equity",
    notes: typeof raw.notes === "string" ? raw.notes : "",
  };
}

export function parseTradeList(raw: unknown): Trade[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => (row && typeof row === "object" ? normalize(row as Record<string, unknown>) : null))
    .filter((row): row is Trade => row !== null);
}

export function loadTrades(): Trade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    return parseTradeList(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveTrades(trades: Trade[]) {
  window.localStorage.setItem(KEY, JSON.stringify(trades));
}

export function tradeNotional(trade: Pick<Trade, "qty" | "price" | "side">) {
  const gross = trade.qty * trade.price;
  return trade.side === "Sell" ? gross : -gross;
}
