"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import { formatPct, pnlClass } from "@/lib/format";
import {
  DOW_PATH_YEARS,
  DOW_TENETS,
  dowForMarket,
  type DowPhase,
  type DowPrimary,
  type DowStance,
} from "@/lib/markets/dow-theory";
import { FeedSource } from "@/components/desk/feed-source";
import { SectorLiveBook } from "@/components/desk/sector-live-book";
import { SectorIndiaMcap } from "@/components/desk/sector-india-mcap";
import {
  SECTOR_AS_OF,
  SECTOR_START,
  SECTOR_YEARS,
  bestCalendarYear,
  sectorsFor,
  type SectorMarket,
  type SectorScore,
} from "@/lib/markets/sector-returns";

type SortKey = "sector" | "cumulative" | "cagr" | number;
type SortState = { key: SortKey; dir: "asc" | "desc" };
type SectorTab = "performance" | "sectors";

function heat(n: number) {
  const mag = Math.min(1, Math.abs(n) / 0.55);
  if (n >= 0) return `rgba(52, 211, 153, ${0.08 + mag * 0.42})`;
  return `rgba(248, 113, 113, ${0.08 + mag * 0.42})`;
}

function sortValue(row: SectorScore, key: SortKey) {
  if (key === "sector") return row.sector;
  if (key === "cumulative") return row.cumulative;
  if (key === "cagr") return row.cagr;
  return row.yearly[key] ?? 0;
}

function DowSpark({ path }: { path: number[] }) {
  if (path.length < 2) return null;
  const min = Math.min(...path);
  const max = Math.max(...path);
  const span = max - min || 1;
  const w = 88;
  const h = 28;
  const d = path
    .map((v, i) => {
      const x = (i / (path.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-[88px]" role="img" aria-label="Sector path from 2021">
      <path d={d} fill="none" stroke="#7dd3fc" strokeWidth="1.75" />
    </svg>
  );
}

function primaryClass(primary: DowPrimary) {
  if (primary === "bull") return "text-gain";
  if (primary === "bear") return "text-loss";
  return "text-muted-foreground";
}

function stanceClass(stance: DowStance) {
  if (stance === "long") return "text-gain";
  if (stance === "short") return "text-loss";
  if (stance === "caution") return "text-foreground";
  return "text-muted-foreground";
}

function phaseLabel(phase: DowPhase) {
  if (phase === "accumulation") return "Accumulation";
  if (phase === "participation") return "Participation";
  if (phase === "distribution") return "Distribution";
  if (phase === "markdown") return "Markdown";
  return "Line";
}

export function SectorAnalysis() {
  const [tab, setTab] = useState<SectorTab>("performance");
  const [market, setMarket] = useState<SectorMarket>("NSE");
  const [sort, setSort] = useState<SortState>({ key: "cumulative", dir: "desc" });
  const rows = useMemo(() => sectorsFor(market), [market]);
  const ranked = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      const cmp =
        typeof av === "string"
          ? av.localeCompare(bv as string)
          : (av as number) - (bv as number);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort]);

  const leader = rows[0];
  const laggard = rows[rows.length - 1];
  const spike = bestCalendarYear(rows);
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.cumulative)), 0.01);
  const dow = useMemo(() => dowForMarket(market, rows), [market, rows]);

  function onSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "sector" ? "asc" : "desc" },
    );
  }

  function mark(key: SortKey) {
    if (sort.key !== key) return "";
    return sort.dir === "asc" ? " ↑" : " ↓";
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-10 px-4 py-10 md:px-8 md:py-14">
      <header className="flex flex-col gap-3">
        <p className="text-primary/90 text-[11px] tracking-[0.3em] uppercase">Sector analysis</p>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
              {tab === "performance" ? "Who paid from 2021" : "Sectors"}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
              {tab === "performance"
                ? `Live book uses 6-month skip-month momentum, a 12-month index gate, and a VIX overlay. History below is total return from ${SECTOR_START} to ${SECTOR_AS_OF}.`
                : market === "NSE"
                  ? "NSE Indices classifies a name by the business that earns more than half of revenue. Defence, Jewellery, Mining, and Sugar are split first, then the rest of the book."
                  : "SPDR / GICS names in this book. Proxy is the ETF used for the tape."}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <FeedSource>{market === "US" ? "Yahoo · SPDR" : "Yahoo · Nifty"}</FeedSource>
            <div className="flex gap-2">
            {(["US", "NSE"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setMarket(id)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-xs tracking-wide uppercase",
                  market === id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary/25 text-muted-foreground hover:border-primary/50",
                )}
              >
                {id}
              </button>
            ))}
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("performance")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
              tab === "performance"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-primary/25 text-muted-foreground hover:border-primary/50",
            )}
          >
            Performance
          </button>
          <button
            type="button"
            onClick={() => setTab("sectors")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
              tab === "sectors"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-primary/25 text-muted-foreground hover:border-primary/50",
            )}
          >
            Sectors
          </button>
        </div>
      </header>

      {tab === "performance" ? <SectorLiveBook market={market} /> : null}

      {tab === "performance" ? (
      <section className="border-border grid gap-6 border-y py-8 md:grid-cols-3">
        <div>
          <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">Best since 2021</p>
          <p className="mt-2 font-heading text-2xl">{leader.sector}</p>
          <p className={`mt-1 font-mono text-lg tabular-nums ${pnlClass(leader.cumulative)}`}>
            {formatPct(leader.cumulative)} · CAGR {formatPct(leader.cagr)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{leader.proxy}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">Weakest since 2021</p>
          <p className="mt-2 font-heading text-2xl">{laggard.sector}</p>
          <p className={`mt-1 font-mono text-lg tabular-nums ${pnlClass(laggard.cumulative)}`}>
            {formatPct(laggard.cumulative)} · CAGR {formatPct(laggard.cagr)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{laggard.proxy}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">Hottest calendar year</p>
          <p className="mt-2 font-heading text-2xl">
            {spike.sector} · {spike.year}
            {spike.year === 2026 ? " YTD" : ""}
          </p>
          <p className={`mt-1 font-mono text-lg tabular-nums ${pnlClass(spike.ret)}`}>{formatPct(spike.ret)}</p>
          <p className="text-muted-foreground mt-1 text-xs">Largest single-year print in this book</p>
        </div>
      </section>
      ) : null}

      {tab === "performance" ? (
        <>
      <section>
        <h2 className="text-muted-foreground mb-5 text-[11px] font-medium tracking-[0.24em] uppercase">
          Cumulative return rank
        </h2>
        <div className="space-y-2.5">
          {rows.map((row, i) => (
            <div key={row.sector} className="grid grid-cols-[7.5rem_1fr_5.5rem] items-center gap-3 text-sm">
              <span className="truncate">
                <span className="text-muted-foreground mr-2 font-mono text-[10px]">{i + 1}</span>
                {row.sector}
              </span>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(Math.abs(row.cumulative) / maxAbs) * 100}%` }}
                />
              </div>
              <span className={`text-right font-mono tabular-nums ${pnlClass(row.cumulative)}`}>
                {formatPct(row.cumulative)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
            Year by year
          </h2>
          <FeedSource>Desk reference</FeedSource>
        </div>
        <div className="overflow-x-auto">
          <table className="w-max min-w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-[10px] tracking-[0.18em] uppercase">
                <th className="pb-3 pr-4 font-medium">
                  <button type="button" onClick={() => onSort("sector")}>
                    Sector{mark("sector")}
                  </button>
                </th>
                {SECTOR_YEARS.map((year, i) => (
                  <th key={year} className="pb-3 pr-3 text-right font-medium">
                    <button type="button" onClick={() => onSort(i)}>
                      {year}
                      {year === 2026 ? " YTD" : ""}
                      {mark(i)}
                    </button>
                  </th>
                ))}
                <th className="pb-3 pr-3 text-right font-medium">
                  <button type="button" onClick={() => onSort("cumulative")}>
                    Since 2021{mark("cumulative")}
                  </button>
                </th>
                <th className="pb-3 text-right font-medium">
                  <button type="button" onClick={() => onSort("cagr")}>
                    CAGR{mark("cagr")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row) => (
                <tr key={row.sector} className="border-border/60 border-b last:border-0">
                  <td className="py-2.5 pr-4">
                    <div>{row.sector}</div>
                    <div className="text-muted-foreground font-mono text-[10px]">{row.proxy}</div>
                  </td>
                  {row.yearly.map((ret, i) => (
                    <td
                      key={SECTOR_YEARS[i]}
                      className={`py-2.5 pr-3 text-right font-mono tabular-nums ${pnlClass(ret)}`}
                      style={{ background: heat(ret) }}
                    >
                      {formatPct(ret)}
                    </td>
                  ))}
                  <td className={`py-2.5 pr-3 text-right font-mono tabular-nums ${pnlClass(row.cumulative)}`}>
                    {formatPct(row.cumulative)}
                  </td>
                  <td className={`py-2.5 text-right font-mono tabular-nums ${pnlClass(row.cagr)}`}>
                    {formatPct(row.cagr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
        </>
      ) : (
        <>
          {market === "NSE" ? <SectorIndiaMcap /> : null}

          <section>
            <div className="mb-5 flex items-start justify-between gap-3">
              <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
                Dow Theory
              </h2>
              <FeedSource>Desk reference</FeedSource>
            </div>
            <div className="border-border mb-8 grid gap-6 border-y py-8 md:grid-cols-3">
              <div className="md:col-span-2">
                <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">Market reading</p>
                <p className="mt-2 font-heading text-2xl">{dow.regime}</p>
                <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">{dow.regimeNote}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">Breadth (volume analog)</p>
                <p className="mt-2 font-mono text-lg tabular-nums">
                  {dow.bullCount} bull · {dow.bearCount} bear · {dow.mixedCount} open
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {formatPct(dow.breadth)} of sectors in a primary bull
                </p>
              </div>
            </div>

            <div className="mb-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {DOW_TENETS.map((tenet) => (
                <div key={tenet.title} className="border-border/60 rounded-lg border px-3 py-3">
                  <p className="text-sm">{tenet.title}</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{tenet.body}</p>
                </div>
              ))}
            </div>

            <h3 className="text-muted-foreground mb-4 text-[11px] font-medium tracking-[0.24em] uppercase">
              Averages must confirm
            </h3>
            <div className="mb-8 grid gap-3 md:grid-cols-2">
              {dow.pairs.map((pair) => (
                <div key={pair.label} className="border-border/60 rounded-lg border px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm">
                      {pair.a} · {pair.b}
                    </p>
                    <p className={cn("text-xs tracking-wide uppercase", pair.confirmed ? "text-gain" : "text-loss")}>
                      {pair.confirmed ? "Confirmed" : "Divergent"}
                    </p>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">{pair.label}</p>
                  <p className="mt-2 text-xs leading-relaxed">{pair.reading}</p>
                  <p className="text-muted-foreground mt-2 font-mono text-[10px]">
                    {pair.a}: {pair.aPrimary} · {pair.b}: {pair.bPrimary}
                  </p>
                </div>
              ))}
            </div>

            <h3 className="text-muted-foreground mb-4 text-[11px] font-medium tracking-[0.24em] uppercase">
              Primary trend by sector
            </h3>
            <div className="overflow-x-auto">
              <table className="w-max min-w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-border border-b text-left text-[10px] tracking-[0.18em] uppercase">
                    <th className="pb-3 pr-4 font-medium">Sector</th>
                    <th className="pb-3 pr-4 font-medium">Path</th>
                    <th className="pb-3 pr-4 font-medium">Structure</th>
                    <th className="pb-3 pr-4 font-medium">Primary</th>
                    <th className="pb-3 pr-4 font-medium">Phase</th>
                    <th className="pb-3 pr-4 font-medium">Stance</th>
                    <th className="pb-3 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {dow.sectors.map((row) => (
                    <tr key={row.sector} className="border-border/60 border-b last:border-0 align-top">
                      <td className="py-3 pr-4">
                        <div>{row.sector}</div>
                        <div className="text-muted-foreground font-mono text-[10px]">{row.proxy}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <DowSpark path={row.path} />
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs whitespace-nowrap">{row.structure}</td>
                      <td className={cn("py-3 pr-4 whitespace-nowrap", primaryClass(row.primary))}>{row.primary}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{phaseLabel(row.phase)}</td>
                      <td className={cn("py-3 pr-4 font-mono text-xs uppercase", stanceClass(row.stance))}>
                        {row.stance}
                      </td>
                      <td className="text-muted-foreground max-w-xs py-3 text-xs leading-relaxed">
                        {row.note}
                        <span className="mt-1 block">{row.secondary}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              Swings on year-end index levels (100 at {DOW_PATH_YEARS[0]}). A primary stays in force until the
              opposite peak or floor is taken out.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

