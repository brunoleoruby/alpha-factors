"use client";

import type { EquityPoint } from "@/lib/trading/types";
import { formatPct, formatUsd } from "@/lib/trading/format";

export function EquityChart({ points }: { points: EquityPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
        Run a backtest to plot the factor book.
      </div>
    );
  }

  const start = points[0].equity;
  const values = points.map((p) => p.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const last = points[points.length - 1];
  const ret = start ? last.equity / start - 1 : 0;

  const w = 920;
  const h = 280;
  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

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

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => min + (span * i) / ticks);
  const xLabels = [0, Math.floor(points.length / 2), points.length - 1].map((i) => ({
    i,
    label: points[i].date.slice(5),
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="font-mono text-emerald-400">{formatUsd(last.equity)}</p>
        <p className={`font-mono ${ret >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {formatPct(ret)} over {points.length} sessions
        </p>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-72 w-full"
        role="img"
        aria-label="Paper book equity curve"
      >
        <defs>
          <linearGradient id="navFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="rgb(52 211 153)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((tick) => {
          const y = xy(0, tick)[1];
          return (
            <g key={tick}>
              <line
                x1={padL}
                x2={padL + innerW}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-border"
                strokeWidth="1"
              />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize="11"
                fontFamily="ui-monospace, monospace"
              >
                {(tick / 1000).toFixed(0)}k
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#navFill)" />
        <path d={line} fill="none" stroke="rgb(52 211 153)" strokeWidth="2.5" />
        {xLabels.map(({ i, label }) => (
          <text
            key={label + i}
            x={xy(i, min)[0]}
            y={h - 8}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="11"
            fontFamily="ui-monospace, monospace"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
