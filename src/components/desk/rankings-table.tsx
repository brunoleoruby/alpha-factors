"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNum, pnlClass } from "@/lib/trading/format";
import type { FactorSnapshot, TargetWeight } from "@/lib/trading/types";
import { FACTOR_IDS } from "@/lib/trading/types";
import { FACTOR_META, instrumentMap } from "@/lib/trading/universe";

export function RankingsTable({
  rankings,
  targets,
}: {
  rankings: FactorSnapshot[];
  targets: TargetWeight[];
}) {
  const names = instrumentMap();
  const targetBySymbol = new Map(targets.map((t) => [t.symbol, t]));

  if (!rankings.length) {
    return <Empty>No factor scores yet.</Empty>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Composite</TableHead>
            {FACTOR_IDS.map((id) => (
              <TableHead key={id} className="text-right">
                {FACTOR_META[id].short}
              </TableHead>
            ))}
            <TableHead className="text-right">Book</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rankings.map((row, i) => {
            const target = targetBySymbol.get(row.symbol);
            const name = names[row.symbol];
            return (
              <TableRow key={row.symbol}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-5 font-mono text-xs">{i + 1}</span>
                    <div>
                      <p className="font-medium">{row.symbol}</p>
                      <p className="text-muted-foreground text-xs">
                        {name?.name} · {name?.sector}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className={`text-right font-mono ${pnlClass(row.composite)}`}>
                  {formatNum(row.composite)}
                </TableCell>
                {FACTOR_IDS.map((id) => (
                  <TableCell key={id} className={`text-right font-mono text-xs ${pnlClass(row.z[id])}`}>
                    {formatNum(row.z[id])}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  {target ? (
                    <Badge variant={target.side === "long" ? "default" : "destructive"}>
                      {target.side} {(Math.abs(target.weight) * 100).toFixed(1)}%
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">flat</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground flex h-40 items-center justify-center text-sm">{children}</p>
  );
}
