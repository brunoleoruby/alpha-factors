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
  INFY_PRICE,
  INSIDER_LABELED,
  SIMILAR_INSIDER_LABELED,
  insiderCategoriesInPlay,
  type LabeledPrint,
} from "@/lib/news/cases/insider-trading";
import type { EventType } from "@/lib/news/taxonomy";
import { cn } from "cn";

function PricePath() {
  const marks = INFY_PRICE;
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
    <svg viewBox={`0 0 ${w} ${h}`} className="bg-card h-52 w-full rounded-xl" role="img" aria-label="Infosys NSE close late May to early June 2021">
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

export function InsiderTradingCaseStudy() {
  const [cat, setCat] = useState<"all" | EventType>("all");
  const inPlay = insiderCategoriesInPlay();
  const ownRows = useMemo(
    () => (cat === "all" ? INSIDER_LABELED : INSIDER_LABELED.filter((p) => p.eventType === cat)),
    [cat],
  );
  const rhymeRows = useMemo(
    () =>
      cat === "all" ? SIMILAR_INSIDER_LABELED : SIMILAR_INSIDER_LABELED.filter((p) => p.eventType === cat),
    [cat],
  );
  const first = INFY_PRICE[0].close;
  const printDay = INFY_PRICE.find((p) => p.date === "2021-06-02")!.close;
  const typical = CASE_CATEGORIES.find((c) => c.id === "insider_trading")!;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 pb-10 md:px-6">
      <header className="mt-2">
        <p className="text-primary text-xs font-medium tracking-[0.22em] uppercase">Worked example · NSE</p>
        <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          Insider trading · PIT / UPSI
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
          Separate event from a tax raid or a generic SEBI review. The desk now tags headlines that name
          insider trading, unpublished price-sensitive information, connected persons, or PIT regulations,
          and fingerprints them at about {formatPct(typical.typical1d)} 1-day / {formatPct(typical.typical5d)}{" "}
          5-day. Infosys in June 2021 is the large-cap version: SEBI interim order, company probe, a
          sub-1% close, then SAT and a 2024 dismissal. Not a live feed.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/nse/stocks/INFY" className="text-primary hover:underline">
            Open INFY chart
          </Link>
          <span className="text-muted-foreground"> · </span>
          <Link href="/nse/cases/polycab" className="text-primary hover:underline">
            Polycab raid case
          </Link>
          <span className="text-muted-foreground"> · </span>
          <Link href="/nse" className="text-primary hover:underline">
            Pattern desk
          </Link>
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="28 May close" value={`₹${first.toLocaleString("en-IN")}`} />
        <Kpi label="2 Jun NSE close" value={`₹${printDay.toLocaleString("en-IN")}`} tone={printDay / first - 1} />
        <Kpi label="Move in window" value={formatPct(printDay / first - 1)} tone={printDay / first - 1} />
        <Kpi label="Typical PIT 1d" value={formatPct(typical.typical1d)} tone={typical.typical1d} />
      </div>

      <Card className="border-primary/15 bg-card/90">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Price through the June 2021 window</CardTitle>
          <CardDescription>
            Stitched NSE-style closes. 2 Jun close follows contemporaneous reports (~₹1,381, −0.45%). SAT
            and the 2024 dismissal are later prints, not on this chart.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PricePath />
        </CardContent>
      </Card>

      <Card className="border-primary/15 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">News categories this desk uses</CardTitle>
          <CardDescription>
            Gold outline = showed up on the Infosys PIT prints. Typical 1d is the fingerprint, not this
            episode’s −0.5% close.
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
          <CardTitle className="text-base">Infosys prints</CardTitle>
          <CardDescription>
            Same keyword rules as the live desk. A SEBI review without PIT language still lands on
            Regulation; a raid still lands on Legal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PrintTable rows={ownRows} />
        </CardContent>
      </Card>

      <Card className="border-primary/15 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">Similar events in other stocks</CardTitle>
          <CardDescription>
            Polycab and Ashoka are raids. Adani is a probe. Reliance is a large-cap PIT analog. TCS is a
            clean IT beat. Filter by category to keep those rhymes from mixing.
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
