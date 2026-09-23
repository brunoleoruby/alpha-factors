"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "cn";
import { FeedSource } from "@/components/desk/feed-source";
import { formatDate, formatPct, pnlClass } from "@/lib/format";
import { wilsonInterval } from "@/lib/algorithm/probability";
import { SPREAD_ACTION, SPREAD_GATES, SPREAD_LAW, SPREAD_UNIVERSE } from "@/lib/algorithm/spread-model";
import {
  analyzePositions,
  hitRateByBuyDate,
  money,
  returnOnCapital,
  summaryForView,
} from "@/lib/portfolio/analytics";
import { parsePositionBook, type PositionBook } from "@/lib/portfolio/positions";
import { SEGMENTS } from "@/lib/portfolio/trades";

type Sleeve = "book" | "spread";

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: number;
}) {
  return (
    <div className="min-w-0 overflow-hidden">
      <p className="text-muted-foreground truncate text-[10px] tracking-[0.14em] uppercase">{label}</p>
      <p
        className={`mt-2 font-mono text-lg tracking-tight break-all tabular-nums md:text-xl ${
          tone !== undefined ? pnlClass(tone) : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function AlgorithmDesk() {
  const [sleeve, setSleeve] = useState<Sleeve>("book");
  const [book, setBook] = useState<PositionBook | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const res = await fetch("/api/portfolio/positions", { cache: "no-store" });
        const body = (await res.json()) as unknown;
        if (!res.ok) throw new Error("Load failed");
        if (dead) return;
        setBook(parsePositionBook(body));
        setError(null);
      } catch {
        if (!dead) setError("Could not read the portfolio book.");
      }
    };
    void load();
    return () => {
      dead = true;
    };
  }, []);

  const view = useMemo(() => {
    if (!book) return null;
    const summary = summaryForView(book.summaries, "all", "all");
    const analytics = analyzePositions(book.positions, summary);
    const hits = hitRateByBuyDate(book.positions);
    const capital = book.totalCapital;
    const roc = returnOnCapital(analytics.netPnl, capital);
    const rocBefore = returnOnCapital(analytics.realized, capital);
    const interval = wilsonInterval(hits.hits, hits.dated);
    const bySegment = SEGMENTS.map((segment) => {
      const slice = analytics.bySegment.find((row) => row.id === segment.id);
      const pnl = slice?.totalPnl ?? 0;
      return {
        id: segment.id,
        label: segment.label,
        names: slice?.trades ?? 0,
        pnl,
        roc: returnOnCapital(pnl, capital),
      };
    });
    return {
      summary,
      analytics,
      hits,
      capital,
      roc,
      rocBefore,
      interval,
      bySegment,
    };
  }, [book]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 pb-10 md:px-6">
      <header className="mt-2">
        <p className="text-primary text-xs font-medium tracking-[0.22em] uppercase">Varun G V · personal</p>
        <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Algorithm</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
          Probability first, then a trade. Book posterior scores names you already have. Spread engine
          is the Nifty 50 pairs model — not live until the gates have data. Not a recommendation.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSleeve("book")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
                sleeve === "book"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/25 text-muted-foreground hover:border-primary/50",
              )}
            >
              Book posterior
            </button>
            <button
              type="button"
              onClick={() => setSleeve("spread")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
                sleeve === "spread"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/25 text-muted-foreground hover:border-primary/50",
              )}
            >
              Spread engine
            </button>
          </div>
          <FeedSource>{sleeve === "book" ? "Portfolio book" : "Model · unread"}</FeedSource>
        </div>
      </header>

      {sleeve === "book" ? <BookSleeve view={view} error={error} /> : <SpreadSleeve />}
    </div>
  );
}

function BookSleeve({
  view,
  error,
}: {
  view: {
    summary: { from?: string; to?: string } | null;
    analytics: { realized: number; netPnl: number; costs: number; openCount: number };
    hits: { hits: number; misses: number; dated: number; hitRate: number | null; names: number };
    capital: number;
    roc: number | null;
    rocBefore: number | null;
    interval: { p: number; lo: number; hi: number } | null;
    bySegment: { id: string; label: string; names: number; pnl: number; roc: number | null }[];
  } | null;
  error: string | null;
}) {
  return (
    <>
      <p className="text-muted-foreground -mt-2 text-xs">
        Hits are Bernoulli with unknown p: a name with an entry date is a trial; realized P&amp;L
        above zero is a hit. The band is a 95% Wilson interval on that p. Return uses desk
        capital, same as Portfolio. Unrealized is ignored.
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <section className="border-border grid grid-cols-2 gap-x-6 gap-y-6 border-y py-6 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Period"
          value={
            view?.summary?.from && view.summary.to
              ? `${formatDate(view.summary.from)} → ${formatDate(view.summary.to)}`
              : "—"
          }
        />
        <Stat label="Capital" value={view && view.capital > 0 ? money(view.capital) : "—"} />
        <Stat label="Trials" value={view ? String(view.hits.dated) : "—"} />
        <Stat label="Hits / misses" value={view ? `${view.hits.hits} / ${view.hits.misses}` : "—"} />
        <Stat
          label="Hit p"
          value={view?.hits.hitRate == null ? "—" : formatPct(view.hits.hitRate)}
          tone={view?.hits.hitRate == null ? undefined : view.hits.hitRate - 0.5}
        />
        <Stat
          label="95% Wilson"
          value={
            view?.interval == null
              ? "—"
              : `${formatPct(view.interval.lo)} – ${formatPct(view.interval.hi)}`
          }
        />
        <Stat
          label="Realized P&L"
          value={view ? money(view.analytics.realized) : "—"}
          tone={view?.analytics.realized}
        />
        <Stat
          label="Return on capital"
          value={view?.rocBefore == null ? "—" : formatPct(view.rocBefore)}
          tone={view?.rocBefore ?? undefined}
        />
        <Stat
          label="Net P&L"
          value={view ? money(view.analytics.netPnl) : "—"}
          tone={view?.analytics.netPnl}
        />
        <Stat
          label="Net return on capital"
          value={view?.roc == null ? "—" : formatPct(view.roc)}
          tone={view?.roc ?? undefined}
        />
      </section>

      <section>
        <h2 className="text-muted-foreground mb-4 text-[11px] font-medium tracking-[0.24em] uppercase">
          By segment · on desk capital
        </h2>
        <div className="overflow-x-auto rounded-xl bg-card text-foreground">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                <th className="px-4 py-2 font-medium">Segment</th>
                <th className="px-3 py-2 text-right font-medium">Names</th>
                <th className="px-3 py-2 text-right font-medium">P&amp;L</th>
                <th className="px-4 py-2 text-right font-medium">On cap</th>
              </tr>
            </thead>
            <tbody>
              {(view?.bySegment ?? []).map((row) => (
                <tr key={row.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2">{row.label}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{row.names}</td>
                  <td className={`px-3 py-2 text-right font-mono tabular-nums ${pnlClass(row.pnl)}`}>
                    {money(row.pnl)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono tabular-nums ${
                      row.roc == null ? "text-muted-foreground" : pnlClass(row.pnl)
                    }`}
                  >
                    {row.roc == null ? "—" : formatPct(row.roc)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function SpreadSleeve() {
  return (
    <>
      <p className="text-muted-foreground -mt-2 text-xs">
        Universe: {SPREAD_UNIVERSE} only. No Main/SME mix, no Chartink scanners. Live quotes and
        gates are unread until the engine is wired.
      </p>
      <section className="border-border grid gap-8 border-y py-6 lg:grid-cols-3">
        <div>
          <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
            01 · Measure
          </h2>
          <p className="mt-3 text-sm leading-relaxed">{SPREAD_LAW}</p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <Stat label="ADF p" value="—" />
            <Stat label="Half-life" value="—" />
            <Stat label="Hurst H" value="—" />
            <Stat label="Kalman β" value="—" />
          </div>
        </div>
        <div>
          <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
            02 · Gates
          </h2>
          <p className="mt-3 text-sm leading-relaxed">
            A trade is an event: all listed tests pass. Status stays unread until each estimator has
            a sample.
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl bg-card text-foreground">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                  <th className="px-4 py-2 font-medium">Gate</th>
                  <th className="px-4 py-2 font-medium">Test</th>
                  <th className="px-4 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {SPREAD_GATES.map((gate) => (
                  <tr key={gate.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2">{gate.label}</td>
                    <td className="text-muted-foreground px-4 py-2 text-xs">{gate.test}</td>
                    <td className="text-muted-foreground px-4 py-2 text-right font-mono text-xs">
                      unread
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
            03 · Validate
          </h2>
          <p className="mt-3 text-sm leading-relaxed">{SPREAD_ACTION}</p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <Stat label="Gates passing" value="—" />
            <Stat label="Paper P&L" value="—" />
            <Stat label="Deflated Sharpe" value="—" />
            <Stat label="PBO" value="—" />
          </div>
        </div>
      </section>
    </>
  );
}
