"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInrFine, formatUsdFine } from "@/lib/format";
import type { ExchangeId, Listing } from "@/lib/markets/types";
import { chartPath } from "@/lib/markets/tv";

export function AllStocksTable({
  listings,
  locale,
}: {
  listings: Listing[];
  locale: ExchangeId;
}) {
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("All");
  const moneyFine = locale === "NSE" ? formatInrFine : formatUsdFine;
  const sectors = useMemo(
    () => ["All", ...[...new Set(listings.map((l) => l.sector))].sort()],
    [listings],
  );
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return listings.filter((l) => {
      if (sector !== "All" && l.sector !== sector) return false;
      if (!needle) return true;
      return (
        l.symbol.toLowerCase().includes(needle) ||
        l.name.toLowerCase().includes(needle) ||
        l.sector.toLowerCase().includes(needle)
      );
    });
  }, [listings, q, sector]);

  return (
    <Card className="border-primary/15 bg-card/90 mx-auto mt-4 w-full max-w-[1600px]">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">
          {locale === "NSE" ? "NSE all stocks" : "US all stocks"}
        </CardTitle>
        <CardDescription>
          {listings.length} names. Open any row for the TradingView chart. Desk reference prices are
          simulated; the chart is live market data from TradingView.
        </CardDescription>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search symbol, name, sector"
            className="sm:max-w-sm"
          />
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="border-input bg-input/30 rounded-lg border px-3 py-2 text-sm"
          >
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <p className="text-muted-foreground text-xs">{rows.length} shown</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Exchange</TableHead>
                <TableHead>Series</TableHead>
                <TableHead className="text-right">Ref. price</TableHead>
                <TableHead className="text-right">Chart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No names match that search.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((l) => (
                  <TableRow key={l.symbol}>
                    <TableCell className="font-mono font-medium">
                      <Link href={chartPath(l.symbol, locale)} className="hover:text-primary underline-offset-4 hover:underline">
                        {l.symbol}
                      </Link>
                    </TableCell>
                    <TableCell>{l.name}</TableCell>
                    <TableCell className="text-muted-foreground">{l.sector}</TableCell>
                    <TableCell>{locale}</TableCell>
                    <TableCell>{locale === "NSE" ? "EQ" : "Common"}</TableCell>
                    <TableCell className="text-right font-mono">{moneyFine(l.startPrice)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={chartPath(l.symbol, locale)} className="text-primary text-sm hover:underline">
                        TradingView
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
