import type { EnvInstrument } from "./environment";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const GIFT_TV_SYMBOL = "NSEIX:NIFTY1!";
export const GIFT_YAHOO_SENTINEL = `TV:${GIFT_TV_SYMBOL}`;

export const GIFT_INSTRUMENT: EnvInstrument = {
  id: "giftnifty",
  yahoo: GIFT_YAHOO_SENTINEL,
  name: "GIFT Nifty",
  short: "GIFT",
  digits: 2,
};

type TvQuote = {
  close?: number;
  change?: number;
  change_abs?: number;
  open?: number;
  high?: number;
  low?: number;
  description?: string;
};

export async function fetchGiftNiftyQuote(): Promise<{
  last: number | null;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
}> {
  const url = `https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(GIFT_TV_SYMBOL)}&fields=close,change,change_abs,open,high,low,description`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": UA,
      Origin: "https://www.tradingview.com",
      Referer: "https://www.tradingview.com/",
    },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`gift ${res.status}`);
  const body = (await res.json()) as TvQuote;
  const last = body.close != null && Number.isFinite(body.close) ? body.close : null;
  const changeAbs = body.change_abs != null && Number.isFinite(body.change_abs) ? body.change_abs : null;
  // TradingView `change` is percent points (0.066 = 0.066%).
  const changePct =
    body.change != null && Number.isFinite(body.change) ? body.change / 100 : null;
  const prevClose = last != null && changeAbs != null ? last - changeAbs : null;
  return {
    last,
    prevClose,
    change: changeAbs,
    changePct,
  };
}

export function isGiftYahoo(yahoo: string) {
  return yahoo.startsWith("TV:");
}
