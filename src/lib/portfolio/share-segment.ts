import { formatDate, formatInrFine, formatPct } from "@/lib/format";
import { downloadHtmlPng } from "@/lib/share/html-png";
import { PROFIT_SHARE_DISCLAIMER } from "./share-profit";

export type SegmentShareRow = {
  id: string;
  label: string;
  names: number;
  gross: number;
  pnl: number;
  roc: number | null;
};

export type SegmentSharePayload = {
  bookLabel: string;
  from?: string;
  to?: string;
  capital: number;
  rows: SegmentShareRow[];
};

export function segmentShareText(payload: SegmentSharePayload) {
  const period =
    payload.from && payload.to
      ? `${formatDate(payload.from)} → ${formatDate(payload.to)}`
      : "This view";
  const capital = payload.capital > 0 ? formatInrFine(payload.capital) : "—";
  const lines = payload.rows.map(
    (row) =>
      `${row.label}  ${row.names} names  Gross ${formatInrFine(row.gross)}  P&L ${formatInrFine(row.pnl)}  On cap ${row.roc == null ? "—" : formatPct(row.roc)}`,
  );
  return [
    "Eminent Corpus",
    payload.bookLabel,
    "By segment",
    period,
    `Capital  ${capital}`,
    "",
    ...(lines.length ? lines : ["No segments in this view."]),
    "",
    PROFIT_SHARE_DISCLAIMER,
  ].join("\n");
}

export function downloadSegmentSharePng(card: HTMLElement) {
  return downloadHtmlPng(card, "eminent-corpus-by-segment.png");
}
