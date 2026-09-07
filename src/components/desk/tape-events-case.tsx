"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPct, pnlClass } from "@/lib/format";
import {
  TAPE_CATEGORIES,
  TAPE_EVENT_IDS,
  TAPE_LABELED,
  type TapeEventId,
} from "@/lib/news/cases/tape-events";
import type { LabeledPrint } from "@/lib/news/cases/polycab";
import { cn } from "cn";

function PrintTable({ rows }: { rows: LabeledPrint[] }) {
  if (!rows.length) {
    return <p className="text-muted-foreground text-sm">No prints in this category.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Headline</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">1d</TableHead>
            <TableHead className="text-right">5d</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.date}-${row.symbol}-${row.headline.slice(0, 24)}`}>
              <TableCell className="font-mono text-xs whitespace-nowrap">{row.date}</TableCell>
              <TableCell>
                <Link href={`/nse/stocks/${row.symbol}`} className="text-primary hover:underline">
                  {row.symbol}
                </Link>
                <p className="text-muted-foreground text-xs">{row.name}</p>
              </TableCell>
              <TableCell className="max-w-md text-sm">
                {row.headline}
                <p className="text-muted-foreground mt-1 text-xs">{row.note}</p>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{row.eventLabel}</Badge>
              </TableCell>
              <TableCell className={`text-right font-mono ${pnlClass(row.ret1d)}`}>{formatPct(row.ret1d)}</TableCell>
              <TableCell className={`text-right font-mono ${pnlClass(row.ret5d)}`}>{formatPct(row.ret5d)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function TapeEventsCaseStudy() {
  const [cat, setCat] = useState<"all" | TapeEventId>("all");
  const rows = useMemo(() => {
    if (cat === "all") return TAPE_LABELED;
    return TAPE_LABELED.filter((p) => p.eventType === cat);
  }, [cat]);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 pb-10 md:px-6">
      <header className="mt-2">
        <p className="text-primary text-xs font-medium tracking-[0.22em] uppercase">Worked example · NSE</p>
        <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          Pledge · QIP · USFDA · Rating
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
          Four event types the tape actually trades, now split from legal, Street downgrades, and generic
          dilution. Adani’s Hindenburg week is here on purpose: the probe, the pledged-share top-up, and
          the pulled FPO are three different fingerprints. Aurobindo’s two-obs 483 closed green; Lupin’s
          analog did not. Market environment stays empty.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/nse/cases/insider" className="text-primary hover:underline">
            Insider trading
          </Link>
          <span className="text-muted-foreground"> · </span>
          <Link href="/nse/cases/polycab" className="text-primary hover:underline">
            Polycab raid
          </Link>
          <span className="text-muted-foreground"> · </span>
          <Link href="/nse" className="text-primary hover:underline">
            Pattern desk
          </Link>
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TAPE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id as TapeEventId)}
            className={cn(
              "rounded-lg border px-3 py-3 text-left",
              cat === c.id ? "border-primary ring-ring ring-2" : "border-primary/25",
            )}
          >
            <p className="text-sm font-medium">{c.label}</p>
            <p className="text-muted-foreground mt-1 text-xs leading-snug">{c.description}</p>
            <p className={`mt-2 font-mono text-xs ${pnlClass(c.typical1d)}`}>
              typical 1d {formatPct(c.typical1d)} · 5d {formatPct(c.typical5d)}
            </p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCat("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs uppercase",
            cat === "all" ? "border-primary bg-primary text-primary-foreground" : "border-primary/25",
          )}
        >
          All prints
        </button>
        {TAPE_EVENT_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setCat(id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs uppercase",
              cat === id ? "border-primary bg-primary text-primary-foreground" : "border-primary/25",
            )}
          >
            {TAPE_CATEGORIES.find((c) => c.id === id)?.label}
          </button>
        ))}
      </div>

      <Card className="border-primary/15 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">Prints</CardTitle>
          <CardDescription>
            Same keyword rules as the live desk. Filter to one type. Contrast rows (Hindenburg, FPO, Street
            upgrade) stay visible on All prints so you can see they do not steal the new tags.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PrintTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
