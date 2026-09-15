"use client";

import { Fragment, type CSSProperties, type Ref } from "react";
import { formatDate, formatInrFine, formatPct } from "@/lib/format";
import type { ProfitBucket } from "@/lib/portfolio/analytics";
import { PROFIT_SHARE_DISCLAIMER, type ProfitSharePayload } from "@/lib/portfolio/share-profit";

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

const metricLabel: CSSProperties = {
  ...td,
  color: "#9a9288",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

function tone(n: number | null): string {
  if (n == null || n === 0) return "#f4efe6";
  return n > 0 ? "#7dba8c" : "#d27a6a";
}

function groups(payload: ProfitSharePayload): { title: string; rows: ProfitBucket[] }[] {
  const fallback: ProfitBucket[] = [{ id: "-", label: "—", names: 0, realized: 0 }];
  return [
    { title: "Month", rows: payload.profits.months.length ? payload.profits.months : fallback },
    { title: "Quarter", rows: payload.profits.quarters.length ? payload.profits.quarters : fallback },
    { title: "Year", rows: payload.profits.years.length ? payload.profits.years : fallback },
  ];
}

export function ProfitShareCard({
  payload,
  cardRef,
}: {
  payload: ProfitSharePayload;
  cardRef: Ref<HTMLDivElement>;
}) {
  const period =
    payload.from && payload.to
      ? `${formatDate(payload.from)} → ${formatDate(payload.to)}`
      : "This view";
  const hitSample =
    payload.hitDated > 0
      ? `${payload.hits} hit / ${payload.misses} miss · ${payload.hitDated} names`
      : "No entry dates";

  const stats: { label: string; value: string; color: string }[] = [
    {
      label: "Capital",
      value: payload.capital > 0 ? formatInrFine(payload.capital) : "—",
      color: "#f4efe6",
    },
    {
      label: "Net P&L",
      value: formatInrFine(payload.netPnl),
      color: tone(payload.netPnl),
    },
    {
      label: "Return",
      value: payload.roc == null ? "—" : formatPct(payload.roc),
      color: tone(payload.roc),
    },
    {
      label: "Annualized",
      value: payload.annualized == null ? "—" : formatPct(payload.annualized),
      color: tone(payload.annualized),
    },
    {
      label: "Hit ratio",
      value: payload.hitRate == null ? "—" : formatPct(payload.hitRate),
      color: "#f4efe6",
    },
    {
      label: "Hits",
      value: hitSample,
      color: "#9a9288",
    },
  ];

  return (
    <div ref={cardRef} data-profit-share-card="v4-stats" style={card}>
      <div style={{ fontFamily: "Georgia, Times New Roman, serif", fontSize: 28, fontWeight: 600 }}>
        Eminent Corpus
      </div>
      <div style={{ marginTop: 8, color: "#9a9288", fontSize: 14 }}>{payload.bookLabel}</div>
      <div style={{ marginTop: 4, marginBottom: 18, color: "#9a9288", fontSize: 14 }}>{period}</div>

      <table style={{ ...tableStyle, marginBottom: 20 }}>
        <colgroup>
          <col style={{ width: "32%" }} />
          <col style={{ width: "68%" }} />
        </colgroup>
        <tbody>
          {stats.map((row) => (
            <tr key={row.label}>
              <td style={metricLabel}>{row.label}</td>
              <td
                style={{
                  ...td,
                  textAlign: "right",
                  fontFamily: "Courier New, Courier, monospace",
                  fontWeight: 600,
                  color: row.color,
                }}
              >
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={tableStyle}>
        <colgroup>
          <col style={{ width: "38%" }} />
          <col style={{ width: "42%" }} />
          <col style={{ width: "20%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>Period</th>
            <th style={{ ...th, textAlign: "right" }}>P&L</th>
            <th style={{ ...th, textAlign: "right" }}>Names</th>
          </tr>
        </thead>
        <tbody>
          {groups(payload).map((group) => (
            <Fragment key={group.title}>
              <tr>
                <td colSpan={3} style={{ ...td, background: "#161411", color: "#9a9288", fontSize: 12, letterSpacing: "0.14em" }}>
                  {group.title.toUpperCase()}
                </td>
              </tr>
              {group.rows.map((row) => {
                const blank = row.id === "-";
                const pnl = blank ? "—" : formatInrFine(row.realized);
                const color = blank ? "#9a9288" : row.realized >= 0 ? "#7dba8c" : "#d27a6a";
                return (
                  <tr key={`${group.title}-${row.id}`}>
                    <td style={{ ...td, textAlign: "left" }}>{row.label}</td>
                    <td
                      style={{
                        ...td,
                        textAlign: "right",
                        fontFamily: "Courier New, Courier, monospace",
                        fontWeight: 600,
                        color,
                      }}
                    >
                      {pnl}
                    </td>
                    <td style={{ ...td, textAlign: "right", color: "#9a9288" }}>
                      {blank ? "—" : row.names}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
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
