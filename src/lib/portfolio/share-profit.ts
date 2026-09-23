import { formatDate, formatInrFine, formatPct } from "@/lib/format";
import { downloadHtmlPng } from "@/lib/share/html-png";
import type { CurvePoint } from "./analytics";

export type ProfitSharePayload = {
  bookLabel: string;
  from?: string;
  to?: string;
  capital: number;
  realized: number;
  rocBeforeCharges: number | null;
  charges: number;
  otherCD: number;
  netPnl: number;
  roc: number | null;
  nifty50: number | null;
  smallcap: number | null;
  curve: CurvePoint[];
};

export const PROFIT_SHARE_DISCLAIMER =
  "Disclaimer: This is a personal performance snapshot of the selected book and period. It is not an offer, solicitation, or recommendation to buy or sell any security, and it is not investment, tax, or legal advice. Past performance is not indicative of future results. Figures are realized P&L (unaudited), may exclude names without buy/sell dates, and can change if the book is edited. Capital and returns use the capital set on this view. Index returns are close-to-close over the same dates and are not a like-for-like comparison with net return on capital. Eminent Corpus is not a SEBI-registered investment adviser. Do your own research.";

function pct(n: number | null) {
  return n == null ? "—" : formatPct(n);
}

export function profitShareText(payload: ProfitSharePayload) {
  const period =
    payload.from && payload.to
      ? `${formatDate(payload.from)} → ${formatDate(payload.to)}`
      : "This view";
  const capital = payload.capital > 0 ? formatInrFine(payload.capital) : "—";
  const vsNifty =
    payload.roc == null || payload.nifty50 == null ? "—" : formatPct(payload.roc - payload.nifty50);
  const vsSmall =
    payload.roc == null || payload.smallcap == null ? "—" : formatPct(payload.roc - payload.smallcap);
  return [
    "Eminent Corpus",
    payload.bookLabel,
    period,
    `Total capital  ${capital}`,
    `Realized P&L  ${formatInrFine(payload.realized)}`,
    `Return on capital  ${pct(payload.rocBeforeCharges)}`,
    `Charges  ${formatInrFine(-payload.charges)}`,
    `Other C/D  ${formatInrFine(payload.otherCD)}`,
    `Net P&L  ${formatInrFine(payload.netPnl)}`,
    `Net return on capital  ${pct(payload.roc)}`,
    `Nifty 50  ${pct(payload.nifty50)}  ·  vs book  ${vsNifty}`,
    `Smallcap 100  ${pct(payload.smallcap)}  ·  vs book  ${vsSmall}`,
    payload.curve.length
      ? `Chart  ${payload.curve.length} points · last ${formatInrFine(payload.curve[payload.curve.length - 1].equity)}`
      : "Chart  —",
    "",
    PROFIT_SHARE_DISCLAIMER,
  ].join("\n");
}

export function downloadProfitSharePng(card: HTMLElement) {
  return downloadHtmlPng(card, "eminent-corpus-performance.png");
}
