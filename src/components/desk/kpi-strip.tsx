"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatPct, formatUsd, pnlClass } from "@/lib/trading/format";
import type { LiveState } from "@/lib/trading/types";

export function KpiStrip({ state }: { state: LiveState }) {
  const last = state.equity[state.equity.length - 1];
  const items = [
    { label: "Paper NAV", value: formatUsd(last?.equity ?? 0), hint: last?.date ?? "—" },
    {
      label: "Total return",
      value: formatPct(state.stats.totalReturn),
      className: pnlClass(state.stats.totalReturn),
    },
    {
      label: "CAGR",
      value: formatPct(state.stats.cagr),
      className: pnlClass(state.stats.cagr),
    },
    { label: "Sharpe", value: state.stats.sharpe.toFixed(2) },
    {
      label: "Max drawdown",
      value: formatPct(state.stats.maxDrawdown),
      className: pnlClass(state.stats.maxDrawdown),
    },
    { label: "Volatility", value: formatPct(state.stats.volatility) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} className="border-border/80 bg-card/80">
          <CardContent className="px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {item.label}
            </p>
            <p className={`mt-1 font-mono text-lg font-semibold ${item.className ?? ""}`}>
              {item.value}
            </p>
            {item.hint ? (
              <p className="text-muted-foreground mt-0.5 text-xs">as of {item.hint}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
