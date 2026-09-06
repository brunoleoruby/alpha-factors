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
  CASE_CATEGORIES,
  POLYCAB_LABELED,
  POLYCAB_PRICE,
  SIMILAR_LABELED,
  categoriesInPlay,
  type LabeledPrint,
} from "@/lib/news/cases/polycab";
import type { EventType } from "@/lib/news/taxonomy";
import { cn } from "cn";

function PricePath() {
  const marks = POLYCAB_PRICE;
  const values = marks.map((m) => m.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 920;
  const h = 220;
  const pad = { l: 52, r: 16, t: 16, b: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const xy = (i: number, v: number) => {
    const x = pad.l + (i / (marks.length - 1)) * innerW;
    const y = pad.t + (1 - (v - min) / span) * innerH;
    return [x, y] as const;
  };
  const d = marks
    .map((m, i) => {
      const [x, y] = xy(i, m.close);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-52 w-full" role="img" aria-label="Polycab NSE close Dec 2023 to Jan 2024">
      <path d={d} fill="none" stroke="#d4bf8a" strokeWidth="2.2" />
      {marks.map((m, i) => {
        const [x, y] = xy(i, m.close);
        return (
          <g key={m.date}>
            <circle cx={x} cy={y} r={m.label ? 4.5 : 3} fill={m.label ? "#d4bf8a" : "#8a7a55"} />
            <text x={x} y={h - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="10" fontFamily="ui-monospace, monospace">
              {m.date.slice(5)}
            </text>
            {m.label ? (
            <text x={x} y={Math.max(12, y - 8)} textAnchor="middle" className="fill-primary" fontSize="9">
                {m.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function PrintTable({ rows }: { rows: LabeledPrint[] }) {
  if (!rows.length) {
    return <p className="text-muted-foreground text-sm">No prints in this category for the window.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Headline</TableHead>
            <TableHead className="text-right">1d</TableHead>
            <TableHead className="text-right">5d</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.symbol}-${r.date}-${r.headline.slice(0, 24)}`}>
              <TableCell className="font-mono text-xs whitespace-nowrap">{r.date}</TableCell>
              <TableCell>
                <Badge variant="outline">{r.eventLabel}</Badge>
              </TableCell>
              <TableCell className="font-medium">
                <span className="font-mono text-xs">{r.symbol}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">{r.name}</span>
              </TableCell>
              <TableCell className="max-w-md text-xs leading-snug">
                {r.headline}
                <span className="text-muted-foreground mt-1 block">{r.note}</span>
              </TableCell>
              <TableCell className={`text-right font-mono ${pnlClass(r.ret1d)}`}>{formatPct(r.ret1d)}</TableCell>
              <TableCell className={`text-right font-mono ${pnlClass(r.ret5d)}`}>{formatPct(r.ret5d)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function PolycabCaseStudy() {
  const [cat, setCat] = useState<"all" | EventType>("all");
  const inPlay = categoriesInPlay();
  const polycabRows = useMemo(
    () => (cat === "all" ? POLYCAB_LABELED : POLYCAB_LABELED.filter((p) => p.eventType === cat)),
    [cat],
  );
  const rhymeRows = useMemo(
    () => (cat === "all" ? SIMILAR_LABELED : SIMILAR_LABELED.filter((p) => p.eventType === cat)),
    [cat],
  );
  const first = POLYCAB_PRICE[0].close;
  const crash = POLYCAB_PRICE.find((p) => p.date === "2024-01-11")!.close;
  const earn = POLYCAB_PRICE.find((p) => p.date === "2024-01-18")!.close;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 pb-10 md:px-6">
      <header className="mt-2">
        <p className="text-primary text-xs font-medium tracking-[0.22em] uppercase">Worked example · NSE</p>
        <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          Polycab · Dec 2023 – Jan 2024
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
          One name, one window. Classify each headline, list every category this desk knows, then rhyme
          the same event type in other stocks and read the 1-day / 5-day path. Dates and closes below
          follow public reports (IT search, CBDT note, Q3 print). Not a live feed.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/nse/stocks/POLYCAB" className="text-primary hover:underline">
            Open POLYCAB chart
          </Link>
          <span className="text-muted-foreground"> · </span>
          <Link href="/nse" className="text-primary hover:underline">
            Pattern desk
          </Link>
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="21 Dec close" value={`₹${first.toLocaleString("en-IN")}`} />
        <Kpi label="11 Jan (CBDT)" value={`₹${crash.toLocaleString("en-IN")}`} tone={crash / first - 1} />
        <Kpi label="Move into crash" value={formatPct(crash / first - 1)} tone={crash / first - 1} />
        <Kpi label="18 Jan (results)" value={`₹${earn.toLocaleString("en-IN")}`} />
      </div>

      <Card className="border-primary/15 bg-card/90">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Price through the window</CardTitle>
          <CardDescription>NSE-style closes stitched from reported levels. Dots mark the news days.</CardDescription>
        </CardHeader>
        <CardContent>
          <PricePath />
        </CardContent>
      </Card>

      <Card className="border-primary/15 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">News categories this desk uses</CardTitle>
          <CardDescription>
            Full list. Gold outline = showed up in the Polycab window. Typical 1d is the fingerprint the
            matcher starts from, not this episode’s print.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CASE_CATEGORIES.map((c) => {
              const used = inPlay.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCat(c.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left",
                    used ? "border-primary/50 bg-primary/5" : "border-border/70",
                    cat === c.id && "ring-ring ring-2",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{c.label}</p>
                    {used ? <Badge>in episode</Badge> : null}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs leading-snug">{c.description}</p>
                  <p className={`mt-1 font-mono text-xs ${pnlClass(c.typical1d)}`}>
                    typical 1d {formatPct(c.typical1d)}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
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
            {inPlay.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setCat(id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs uppercase",
                  cat === id ? "border-primary bg-primary text-primary-foreground" : "border-primary/25",
                )}
              >
                {CASE_CATEGORIES.find((c) => c.id === id)?.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/15 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">Polycab prints</CardTitle>
          <CardDescription>
            Each row is classified by the same keyword rules as the live desk (legal / probe, earnings
            beat, analyst upgrade, …).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PrintTable rows={polycabRows} />
        </CardContent>
      </Card>

      <Card className="border-primary/15 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">Similar events in other stocks</CardTitle>
          <CardDescription>
            Same category, different name. Compare 1d and 5d. Mankind’s raid barely stuck; Ashoka and
            Adani rhymed with Polycab’s −21% legal day. KEI’s beat rallied; Infosys’s beat sold — the
            rhyme for Polycab’s results that did not gap up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PrintTable rows={rhymeRows} />
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <Card className="border-primary/15 bg-card/90">
      <CardContent className="px-4 py-3">
        <p className="text-muted-foreground text-[10px] font-medium tracking-[0.16em] uppercase">{label}</p>
        <p className={`mt-1 font-mono text-lg font-semibold ${tone !== undefined ? pnlClass(tone) : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
