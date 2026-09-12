export type Listing = {
  symbol: string;
  name: string;
  sector: string;
  startPrice: number;
  /** NSE: ₹ crore. US: USD. Desk reference, not a live print. */
  marketCap: number;
};

export type ExchangeId = "US" | "NSE";
