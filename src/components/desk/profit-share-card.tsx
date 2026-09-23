"use client";

import { type CSSProperties, type Ref } from "react";
import { formatDate, formatDateShort, formatInrFine, formatPct } from "@/lib/format";
import type { CurvePoint } from "@/lib/portfolio/analytics";
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

function axisTick(tick: number) {
  const a = Math.abs(tick);
  const sign = tick < 0 ? "−" : "";
  if (a >= 10_000_000) return `${sign}₹${(a / 10_000_000).toFixed(1)}Cr`;
  if (a >= 100_000) return `${sign}₹${(a / 100_000).toFixed(1)}L`;
  if (a >= 1000) return `${sign}₹${(a / 1000).toFixed(0)}k`;
  return `${sign}₹${Math.round(a)}`;
}

function ShareCurve({ points }: { points: CurvePoint[] }) {
  const w = 664;
  const h = 200;
  const padL = 62;
  const padR = 10;
  const padT = 12;
  const padB = 26;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  if (points.length < 2) {
    return (
      <div
        style={{
          height: h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9a9288",
          fontSize: 13,
          border: "1px solid #3a342e",
          background: "#161411",
        }}
      >
        No chart for this view yet.
      </div>
    );
  }

  const values = points.map((p) => p.equity);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const last = points[points.length - 1];
  const xy = (i: number, value: number) => {
    const x = padL + (i / (points.length - 1)) * innerW;
    const y = padT + (1 - (value - min) / span) * innerH;
    return [x, y] as const;
  };
  const line = points
    .map((p, i) => {
      const [x, y] = xy(i, p.equity);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `${line} L${(padL + innerW).toFixed(2)} ${(padT + innerH).toFixed(2)} L${padL} ${(padT + innerH).toFixed(2)} Z`;
  const yTicks = Array.from({ length: 5 }, (_, i) => min + (span * i) / 4);
  const xLabels = [...new Set([0, Math.floor(points.length / 2), points.length - 1])].map((i) => ({
    i,
    label: formatDateShort(points[i].date),
  }));
  const zeroY = padT + (1 - (0 - min) / span) * innerH;
  const stroke = last.equity >= 0 ? "#7dba8c" : "#d27a6a";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Total portfolio net P&L">
      <defs>
        <linearGradient id="shareCurveFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill="#161411" />
      {yTicks.map((tick) => {
        const y = padT + (1 - (tick - min) / span) * innerH;
        return (
          <g key={tick}>
            <line x1={padL} x2={padL + innerW} y1={y} y2={y} stroke="#3a342e" />
            <text x={padL - 8} y={y + 4} textAnchor="end" fill="#9a9288" fontSize="10" fontFamily="Arial, Helvetica, sans-serif">
              {axisTick(tick)}
            </text>
          </g>
        );
      })}
      <line x1={padL} x2={padL + innerW} y1={zeroY} y2={zeroY} stroke="#5a534c" strokeDasharray="4 4" />
      <path d={area} fill="url(#shareCurveFill)" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" />
      {xLabels.map((item) => {
        const [x] = xy(item.i, points[item.i].equity);
        return (
          <text
            key={item.i}
            x={x}
            y={h - 8}
            textAnchor={item.i === 0 ? "start" : item.i === points.length - 1 ? "end" : "middle"}
            fill="#9a9288"
            fontSize="10"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            {item.label}
          </text>
        );
      })}
    </svg>
  );
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

  const stats: { label: string; value: string; color: string }[] = [
    {
      label: "Total capital",
      value: payload.capital > 0 ? formatInrFine(payload.capital) : "—",
      color: "#f4efe6",
    },
    {
      label: "Realized P&L",
      value: formatInrFine(payload.realized),
      color: tone(payload.realized),
    },
    {
      label: "Return on capital",
      value: payload.rocBeforeCharges == null ? "—" : formatPct(payload.rocBeforeCharges),
      color: tone(payload.rocBeforeCharges),
    },
    {
      label: "Charges",
      value: formatInrFine(-payload.charges),
      color: tone(-payload.charges),
    },
    {
      label: "Other C/D",
      value: formatInrFine(payload.otherCD),
      color: tone(payload.otherCD),
    },
    {
      label: "Net P&L",
      value: formatInrFine(payload.netPnl),
      color: tone(payload.netPnl),
    },
    {
      label: "Net return on capital",
      value: payload.roc == null ? "—" : formatPct(payload.roc),
      color: tone(payload.roc),
    },
  ];

  const vs: { label: string; value: string; color: string }[] = [
    {
      label: "Book",
      value: payload.roc == null ? "—" : formatPct(payload.roc),
      color: tone(payload.roc),
    },
    {
      label: "Nifty 50",
      value: payload.nifty50 == null ? "—" : formatPct(payload.nifty50),
      color: tone(payload.nifty50),
    },
    {
      label: "Vs Nifty 50",
      value:
        payload.roc == null || payload.nifty50 == null ? "—" : formatPct(payload.roc - payload.nifty50),
      color: tone(payload.roc == null || payload.nifty50 == null ? null : payload.roc - payload.nifty50),
    },
    {
      label: "Smallcap 100",
      value: payload.smallcap == null ? "—" : formatPct(payload.smallcap),
      color: tone(payload.smallcap),
    },
    {
      label: "Vs Smallcap 100",
      value:
        payload.roc == null || payload.smallcap == null
          ? "—"
          : formatPct(payload.roc - payload.smallcap),
      color: tone(
        payload.roc == null || payload.smallcap == null ? null : payload.roc - payload.smallcap,
      ),
    },
  ];

  return (
    <div ref={cardRef} data-profit-share-card="v5-performance" style={card}>
      <img src="/brand/eminent-corpus-logo.png" width={160} height={82} alt="" />
      <div style={{ marginTop: 8, color: "#9a9288", fontSize: 14 }}>{payload.bookLabel}</div>
      <div style={{ marginTop: 4, marginBottom: 18, color: "#9a9288", fontSize: 14 }}>{period}</div>

      <table style={{ ...tableStyle, marginBottom: 16 }}>
        <colgroup>
          <col style={{ width: "42%" }} />
          <col style={{ width: "58%" }} />
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

      <div
        style={{
          marginBottom: 8,
          color: "#9a9288",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Vs Nifty 50 · Smallcap 100
      </div>
      <table style={{ ...tableStyle, marginBottom: 16 }}>
        <colgroup>
          <col style={{ width: "42%" }} />
          <col style={{ width: "58%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>Index</th>
            <th style={{ ...th, textAlign: "right" }}>Return</th>
          </tr>
        </thead>
        <tbody>
          {vs.map((row) => (
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

      <div
        style={{
          marginBottom: 8,
          color: "#9a9288",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Total portfolio
      </div>
      <ShareCurve points={payload.curve} />

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
