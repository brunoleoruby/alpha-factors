"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPct, formatUsd, formatUsdFine, pnlClass } from "@/lib/trading/format";
import type { Position } from "@/lib/trading/types";
import { instrumentMap } from "@/lib/trading/universe";

export function PositionsTable({ positions }: { positions: Position[] }) {
  const names = instrumentMap();
  if (!positions.length) {
    return (
      <p className="text-muted-foreground flex h-40 items-center justify-center text-sm">
        No open positions. Rebuild the book or wait for the next rebalance.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead className="text-right">Shares</TableHead>
            <TableHead className="text-right">Avg</TableHead>
            <TableHead className="text-right">Market value</TableHead>
            <TableHead className="text-right">Weight</TableHead>
            <TableHead className="text-right">Unrealized</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((p) => (
            <TableRow key={p.symbol}>
              <TableCell>
                <p className="font-medium">{p.symbol}</p>
                <p className="text-muted-foreground text-xs">{names[p.symbol]?.sector}</p>
              </TableCell>
              <TableCell className="text-right font-mono">{p.shares.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono">{formatUsdFine(p.avgPrice)}</TableCell>
              <TableCell className="text-right font-mono">{formatUsd(p.marketValue)}</TableCell>
              <TableCell className="text-right font-mono">{formatPct(p.weight)}</TableCell>
              <TableCell className={`text-right font-mono ${pnlClass(p.unrealizedPnl)}`}>
                {formatUsd(p.unrealizedPnl)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
