"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatPct, pnlClass } from "@/lib/format";
import { analyzePositions, money, returnOnCapital, summaryForView } from "@/lib/portfolio/analytics";
import {
  loadPositionBook,
  parsePositionBook,
  type PositionLine,
  type AccountSummaries,
} from "@/lib/portfolio/positions";

function Chip({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">{label}</p>
      <p
        className={`mt-1.5 font-mono text-lg tabular-nums ${
          tone !== undefined ? pnlClass(tone) : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function LiveBookStrip() {
  const [positions, setPositions] = useState<PositionLine[]>([]);
  const [summaries, setSummaries] = useState<AccountSummaries>({});
  const [totalCapital, setTotalCapital] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;
    const boot = async () => {
      const local = loadPositionBook();
      try {
        const res = await fetch("/api/portfolio/positions", { cache: "no-store" });
        const body = parsePositionBook(await res.json());
        if (!dead) {
          setPositions(body.positions.length ? body.positions : local.positions);
          setSummaries(Object.keys(body.summaries).length ? body.summaries : local.summaries);
          setTotalCapital(body.totalCapital || local.totalCapital);
        }
      } catch {
        if (!dead) {
          setPositions(local.positions);
          setSummaries(local.summaries);
          setTotalCapital(local.totalCapital);
        }
      } finally {
        if (!dead) setReady(true);
      }
    };
    void boot();
    return () => {
      dead = true;
    };
  }, []);

  const book = useMemo(
    () => analyzePositions(positions, summaryForView(summaries, "all", "all")),
    [positions, summaries],
  );

  const roc = returnOnCapital(book.netPnl, totalCapital);

  if (!ready) return null;

  if (!positions.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No P&amp;L loaded.{" "}
        <Link href="/portfolio" className="text-primary hover:underline">
          Upload pnl-TR8076.xlsx
        </Link>{" "}
        to see net P&amp;L after charges here.
      </p>
    );
  }

  return (
    <section className="border-border border-y py-6">
      <p className="text-muted-foreground mb-5 text-[11px] font-medium tracking-[0.24em] uppercase">
        Your book · file P&amp;L ·{" "}
        <Link href="/portfolio" className="text-primary hover:underline">
          Open book
        </Link>
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4 xl:grid-cols-8">
        <Chip label="Stocks" value={String(positions.length)} />
        <Chip label="Realized" value={money(book.realized)} tone={book.realized} />
        <Chip label="Charges" value={money(-book.costs)} tone={-book.costs} />
        <Chip label="Net P&L" value={money(book.netPnl)} tone={book.netPnl} />
        <Chip
          label="On capital"
          value={roc == null ? "—" : formatPct(roc)}
          tone={roc == null ? undefined : roc}
        />
        <Chip label="Open names" value={String(book.names)} />
        <Chip label="Open gross" value={money(book.gross)} />
        <Chip
          label="Top weight"
          value={book.topWeight ? formatPct(book.topWeight) : "—"}
          tone={book.concentrated ? -1 : undefined}
        />
      </div>
      <p className="text-muted-foreground mt-4 text-xs">
        Net = realized + other C/D − charges from the P&amp;L file. Unrealized is ignored.
        {book.concentrated ? " Top open name ≥ 50% of gross." : ""}
      </p>
    </section>
  );
}
