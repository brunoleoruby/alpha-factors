"use client";

import { type CSSProperties, type Ref } from "react";
import { formatDate, formatInrFine, formatPct } from "@/lib/format";
import { PROFIT_SHARE_DISCLAIMER } from "@/lib/portfolio/share-profit";
import type { SegmentSharePayload } from "@/lib/portfolio/share-segment";

const card: CSSProperties = {
  width: 720,
  boxSizing: "border-box",
  background: "#1c1916",
  color: "#f4efe6",
  padding: 28,
  fontFamily: "Arial, Helvetica, sans-serif",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
  fontSize: 15,
};

const th: CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #3a342e",
  background: "#161411",
  color: "#9a9288",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontWeight: 600,
};

const td: CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #3a342e",
  verticalAlign: "middle",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

function tone(n: number): string {
  if (n === 0) return "#f4efe6";
  return n > 0 ? "#7dba8c" : "#d27a6a";
}

export function SegmentShareCard({
  payload,
  cardRef,
}: {
  payload: SegmentSharePayload;
  cardRef: Ref<HTMLDivElement>;
}) {
  const period =
    payload.from && payload.to
      ? `${formatDate(payload.from)} → ${formatDate(payload.to)}`
      : "This view";
  const rows = payload.rows.length
    ? payload.rows
    : [{ id: "-", label: "—", names: 0, gross: 0, pnl: 0, roc: null }];

  return (
    <div ref={cardRef} data-segment-share-card="v1" style={card}>
      <img src="/brand/eminent-corpus-logo.png" width={160} height={82} alt="" />
      <div style={{ marginTop: 8, color: "#9a9288", fontSize: 14 }}>{payload.bookLabel}</div>
      <div style={{ marginTop: 4, color: "#9a9288", fontSize: 14 }}>{period}</div>
      <div
        style={{
          marginTop: 16,
          marginBottom: 8,
          color: "#9a9288",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        By segment
      </div>
      <div style={{ marginBottom: 16, color: "#9a9288", fontSize: 13 }}>
        Capital {payload.capital > 0 ? formatInrFine(payload.capital) : "—"}
      </div>

      <table style={tableStyle}>
        <colgroup>
          <col style={{ width: "28%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "20%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>Segment</th>
            <th style={{ ...th, textAlign: "right" }}>Names</th>
            <th style={{ ...th, textAlign: "right" }}>Gross</th>
            <th style={{ ...th, textAlign: "right" }}>P&L</th>
            <th style={{ ...th, textAlign: "right" }}>On cap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const blank = row.id === "-";
            return (
              <tr key={row.id}>
                <td style={{ ...td, textAlign: "left" }}>{row.label}</td>
                <td style={{ ...td, textAlign: "right", color: "#9a9288" }}>
                  {blank ? "—" : row.names}
                </td>
                <td
                  style={{
                    ...td,
                    textAlign: "right",
                    fontFamily: "Courier New, Courier, monospace",
                    fontWeight: 600,
                    color: blank ? "#9a9288" : "#f4efe6",
                  }}
                >
                  {blank ? "—" : formatInrFine(row.gross)}
                </td>
                <td
                  style={{
                    ...td,
                    textAlign: "right",
                    fontFamily: "Courier New, Courier, monospace",
                    fontWeight: 600,
                    color: blank ? "#9a9288" : tone(row.pnl),
                  }}
                >
                  {blank ? "—" : formatInrFine(row.pnl)}
                </td>
                <td
                  style={{
                    ...td,
                    textAlign: "right",
                    fontFamily: "Courier New, Courier, monospace",
                    fontWeight: 600,
                    color: blank || row.roc == null ? "#9a9288" : tone(row.roc),
                  }}
                >
                  {blank || row.roc == null ? "—" : formatPct(row.roc)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div
        style={{
          marginTop: 20,
          paddingTop: 14,
          borderTop: "1px solid #3a342e",
          color: "#8a847c",
          fontSize: 11,
          lineHeight: 1.5,
          whiteSpace: "normal",
        }}
      >
        {PROFIT_SHARE_DISCLAIMER}
      </div>
    </div>
  );
}
