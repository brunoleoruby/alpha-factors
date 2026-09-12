"use client";

import { useState, type PointerEvent } from "react";
import { formatDate, formatDateShort, formatPct, formatUsd, pnlClass } from "@/lib/format";

export type NavPoint = { date: string; equity: number };

function axisTick(tick: number) {
  const a = Math.abs(tick);
  if (a >= 10_000_000) return `${(tick / 10_000_000).toFixed(1)}Cr`;
  if (a >= 100_000) return `${(tick / 100_000).toFixed(1)}L`;
  if (a >= 1000) return `${(tick / 1000).toFixed(0)}k`;
  return String(Math.round(tick));
}

export function EquityChart({
  points,
  money = formatUsd,
  emptyLabel = "The news book will plot once the algorithm starts trading recognized patterns.",
  fillId = "navFill",
  ariaLabel = "Equity",
}: {
  points: NavPoint[];
  money?: (n: number) => string;
  emptyLabel?: string;
  fillId?: string;
  ariaLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
        {emptyLabel}
      </div>
    );
  }

  const start = points[0].equity;
  const values = points.map((p) => p.equity);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const last = points[points.length - 1];
  const ret = start ? last.equity / start - 1 : null;
  const active = hover == null ? last : points[hover];
  const activeI = hover == null ? points.length - 1 : hover;

  const w = 920;
  const h = 280;
  const padL = 58;
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
    label: formatDateShort(points[i].date),
  }));

  const [hx, hy] = xy(activeI, active.equity);
  const tipRight = hx > w * 0.62;

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const x = ((event.clientX - rect.left) / rect.width) * w;
    const t = (x - padL) / innerW;
    const i = Math.round(t * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className={`font-mono ${pnlClass(active.equity)}`}>{money(active.equity)}</p>
        <p className="font-mono text-slate-500">
          {hover == null
            ? ret == null
              ? `${points.length} marks · ${formatDateShort(points[0].date)} → ${formatDateShort(last.date)}`
              : `${formatPct(ret)} over ${points.length} sessions`
            : formatDate(active.date)}
        </p>
      </div>
      <div className="rounded-xl bg-white p-3">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-64 w-full cursor-crosshair bg-white md:h-72"
          role="img"
          aria-label={ariaLabel}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e5a9a" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#1e5a9a" stopOpacity="0" />
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
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="11"
                  fontFamily="ui-monospace, monospace"
                >
                  {axisTick(tick)}
                </text>
              </g>
            );
          })}
          <path d={area} fill={`url(#${fillId})`} />
          <path d={line} fill="none" stroke="#1e5a9a" strokeWidth="2.25" />
          {xLabels.map(({ i, label }) => (
            <text
              key={label + i}
              x={xy(i, min)[0]}
              y={h - 8}
              textAnchor="middle"
              fill="#64748b"
              fontSize="11"
              fontFamily="ui-monospace, monospace"
            >
              {label}
            </text>
          ))}
          {hover != null ? (
            <g pointerEvents="none">
              <line
                x1={hx}
                x2={hx}
                y1={padT}
                y2={padT + innerH}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <circle cx={hx} cy={hy} r="4.5" fill="#1e5a9a" stroke="#fff" strokeWidth="2" />
              <rect
                x={tipRight ? hx - 168 : hx + 10}
                y={Math.max(padT, hy - 34)}
                width="158"
                height="40"
                rx="6"
                fill="#0f172a"
              />
              <text
                x={tipRight ? hx - 160 : hx + 18}
                y={Math.max(padT, hy - 34) + 16}
                fill="#e2e8f0"
                fontSize="11"
                fontFamily="ui-monospace, monospace"
              >
                {formatDate(active.date)}
              </text>
              <text
                x={tipRight ? hx - 160 : hx + 18}
                y={Math.max(padT, hy - 34) + 32}
                fill="#fff"
                fontSize="12"
                fontFamily="ui-monospace, monospace"
                fontWeight="600"
              >
                {money(active.equity)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
    </div>
  );
}
