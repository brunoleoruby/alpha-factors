import { formatDate, formatInrFine, formatPct } from "@/lib/format";
import { downloadHtmlPng } from "@/lib/share/html-png";
import type { ProfitBook } from "./analytics";

export type ProfitSharePayload = {
  bookLabel: string;
  from?: string;
  to?: string;
  capital: number;
  netPnl: number;
  roc: number | null;
  annualized: number | null;
  hitRate: number | null;
  hits: number;
  misses: number;
  hitDated: number;
  profits: ProfitBook;
};

export const PROFIT_SHARE_DISCLAIMER =
  "Disclaimer: This is a personal performance snapshot of the selected book and period. It is not an offer, solicitation, or recommendation to buy or sell any security, and it is not investment, tax, or legal advice. Past performance is not indicative of future results. Figures are realized P&L (unaudited), may exclude names without buy/sell dates, and can change if the book is edited. Capital and returns use the capital set on this view. Eminent Corpus is not a SEBI-registered investment adviser. Do your own research.";

function linesFor(title: string, rows: { label: string; realized: number; names: number }[]) {
  if (!rows.length) return [`${title}: —`];
  return [title, ...rows.map((row) => `${row.label}  ${formatInrFine(row.realized)}  (${row.names})`)];
}

export function profitShareText(payload: ProfitSharePayload) {
  const period =
    payload.from && payload.to
      ? `${formatDate(payload.from)} → ${formatDate(payload.to)}`
      : "This view";
  const capital = payload.capital > 0 ? formatInrFine(payload.capital) : "—";
  const roc = payload.roc == null ? "—" : formatPct(payload.roc);
  const ann = payload.annualized == null ? "—" : formatPct(payload.annualized);
  const hit =
    payload.hitRate == null
      ? "—"
      : `${formatPct(payload.hitRate)}  (${payload.hits} hit / ${payload.misses} miss · ${payload.hitDated} names)`;
  return [
    "Eminent Corpus",
    payload.bookLabel,
    period,
    `Capital  ${capital}`,
    `Net P&L  ${formatInrFine(payload.netPnl)}`,
    `Return  ${roc}`,
    `Annualized  ${ann}`,
    `Hit ratio  ${hit}`,
    "",
    ...linesFor("Month", payload.profits.months),
    "",
    ...linesFor("Quarter", payload.profits.quarters),
    "",
    ...linesFor("Year", payload.profits.years),
    "",
    PROFIT_SHARE_DISCLAIMER,
  ].join("\n");
}

export function downloadProfitSharePng(card: HTMLElement) {
  return downloadHtmlPng(card, "eminent-corpus-profit-table.png");
}
