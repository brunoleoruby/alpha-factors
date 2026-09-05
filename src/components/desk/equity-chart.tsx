"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "@/lib/trading/types";
import { formatPct, formatUsd } from "@/lib/trading/format";

export function EquityChart({ points }: { points: EquityPoint[] }) {
  if (!points.length) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
        Run a backtest to plot the factor book.
      </div>
    );
  }

  const start = points[0].equity;
  const data = points.map((p) => ({
    date: p.date.slice(5),
    fullDate: p.date,
    nav: p.equity,
    ret: start ? p.equity / start - 1 : 0,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="oklch(1 0 0 / 8%)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: "oklch(0.205 0 0)",
              border: "1px solid oklch(1 0 0 / 12%)",
              borderRadius: 8,
            }}
            labelStyle={{ color: "oklch(0.985 0 0)" }}
            formatter={(value, name) => {
              if (name === "nav") return [formatUsd(Number(value)), "NAV"];
              return [formatPct(Number(value)), "Return"];
            }}
            labelFormatter={(_, payload) => payload?.[0]?.payload.fullDate ?? ""}
          />
          <Line
            type="monotone"
            dataKey="nav"
            stroke="oklch(0.84 0.14 155)"
            strokeWidth={2}
            dot={false}
            name="nav"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
