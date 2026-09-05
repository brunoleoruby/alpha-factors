"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUsd, formatUsdFine } from "@/lib/trading/format";
import type { Trade } from "@/lib/trading/types";

export function TradesTable({ trades }: { trades: Trade[] }) {
  if (!trades.length) {
    return (
      <p className="text-muted-foreground flex h-40 items-center justify-center text-sm">
        No fills yet. The blotter fills when the book rebalances.
      </p>
    );
  }

  const rows = [...trades].reverse().slice(0, 80);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Symbol</TableHead>
            <TableHead>Side</TableHead>
            <TableHead className="text-right">Shares</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Notional</TableHead>
            <TableHead className="text-right">Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t, i) => (
            <TableRow key={`${t.date}-${t.symbol}-${t.side}-${i}`}>
              <TableCell className="font-mono text-xs">{t.date}</TableCell>
              <TableCell className="font-medium">{t.symbol}</TableCell>
              <TableCell className={t.side === "buy" ? "text-emerald-400" : "text-rose-400"}>
                {t.side}
              </TableCell>
              <TableCell className="text-right font-mono">{t.shares.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono">{formatUsdFine(t.price)}</TableCell>
              <TableCell className="text-right font-mono">{formatUsd(t.notional)}</TableCell>
              <TableCell className="text-right font-mono">{formatUsdFine(t.cost)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
