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
import { formatInrCrore, formatInrFine, formatUsdCompact, formatUsdFine } from "@/lib/format";
import type { ExchangeId, Listing } from "@/lib/markets/types";
import { chartPath } from "@/lib/markets/tv";

type SortKey = "symbol" | "name" | "sector" | "marketCap" | "startPrice";
type SortState = { key: SortKey; dir: "asc" | "desc" };

function toggleSort(prev: SortState, key: SortKey): SortState {
  if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
  return { key, dir: key === "symbol" || key === "name" || key === "sector" ? "asc" : "desc" };
}

function sortValue(row: Listing, key: SortKey) {
  switch (key) {
    case "symbol":
      return row.symbol;
    case "name":
      return row.name;
    case "sector":
      return row.sector;
    case "marketCap":
      return row.marketCap;
    case "startPrice":
      return row.startPrice;
  }
}

function SortHead({
  label,
  column,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortKey;
  sort: SortState;
  onSort: (next: SortState) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === column;
  const mark = !active ? "" : sort.dir === "asc" ? " ↑" : " ↓";
  return (
    <TableHead className={`${align === "right" ? "text-right" : "text-left"} w-px px-3`}>
      <button
        type="button"
        className={`hover:text-foreground ${active ? "text-foreground" : "text-muted-foreground"}`}
        onClick={() => onSort(toggleSort(sort, column))}
      >
        {label}
        {mark}
      </button>
    </TableHead>
  );
}

export function AllStocksTable({
  listings,
  locale,
  title,
}: {
  listings: Listing[];
  locale: ExchangeId;
  title?: string;
}) {
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("All");
  const [sort, setSort] = useState<SortState>({ key: "marketCap", dir: "desc" });
  const moneyFine = locale === "NSE" ? formatInrFine : formatUsdFine;
  const sectors = useMemo(
    () => ["All", ...[...new Set(listings.map((l) => l.sector))].sort()],
    [listings],
  );
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = listings.filter((l) => {
      if (sector !== "All" && l.sector !== sector) return false;
      if (!needle) return true;
      return (
        l.symbol.toLowerCase().includes(needle) ||
        l.name.toLowerCase().includes(needle) ||
        l.sector.toLowerCase().includes(needle)
      );
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = sortValue(a, sort.key);
      const right = sortValue(b, sort.key);
      if (typeof left === "number" && typeof right === "number") return (left - right) * dir;
      return String(left).localeCompare(String(right)) * dir;
    });
  }, [listings, q, sector, sort]);

  return (
    <Card className="border-primary/15 bg-card/90 mx-auto mt-4 w-full max-w-[1600px]">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">
          {title ?? (locale === "NSE" ? "NSE all stocks" : "US all stocks")}
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
        <p className="text-muted-foreground text-xs">{rows.length} shown. Click a column to sort.</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="w-max" style={{ width: "max-content" }}>
            <TableHeader>
              <TableRow>
                <SortHead label="Symbol" column="symbol" sort={sort} onSort={setSort} />
                <SortHead label="Company" column="name" sort={sort} onSort={setSort} />
                <SortHead label="Sector" column="sector" sort={sort} onSort={setSort} />
                <SortHead label="Market cap" column="marketCap" sort={sort} onSort={setSort} align="right" />
                <SortHead label="Ref. price" column="startPrice" sort={sort} onSort={setSort} align="right" />
                <TableHead className="w-px px-3 text-right">Chart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No names match that search.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((l) => (
                  <TableRow key={l.symbol}>
                    <TableCell className="w-px px-3 font-mono font-medium">
                      <Link href={chartPath(l.symbol, locale)} className="hover:text-primary underline-offset-4 hover:underline">
                        {l.symbol}
                      </Link>
                    </TableCell>
                    <TableCell className="w-px px-3">{l.name}</TableCell>
                    <TableCell className="text-muted-foreground w-px px-3">{l.sector}</TableCell>
                    <TableCell className="w-px px-3 text-right font-mono tabular-nums">
                      {locale === "NSE" ? formatInrCrore(l.marketCap) : formatUsdCompact(l.marketCap)}
                    </TableCell>
                    <TableCell className="w-px px-3 text-right font-mono tabular-nums">
                      {moneyFine(l.startPrice)}
                    </TableCell>
                    <TableCell className="w-px px-3 text-right">
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
