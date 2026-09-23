"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "cn";
import { FeedSource } from "@/components/desk/feed-source";
import { DefenceIndexCandle } from "@/components/desk/defence-index-candle";
import { formatInrCrore, formatInrLakhCrore, formatPct } from "@/lib/format";
import type { IndiaCapGroup, IndiaListedName, IndiaSectorCapBook } from "@/lib/markets/india-sector-mcap";
import type { ThemeIndex } from "@/lib/markets/capped-mcap-index";

type Level = "sector" | "industry" | "basic";

const THEME_PILLS = [
  { industry: "Defence", sector: "Industrials", label: "Defence 15" },
  { industry: "Jewellery", sector: "Consumer Discretionary", label: "Jewellery 15" },
  { industry: "Mining", sector: "Commodities", label: "Mining 15" },
  { industry: "Sugar", sector: "Fast Moving Consumer Goods", label: "Sugar 15" },
] as const;

function capLabel(inr: number) {
  if (inr >= 1e12) return formatInrLakhCrore(inr);
  return formatInrCrore(inr / 1e7);
}

export function SectorIndiaMcap() {
  const [book, setBook] = useState<IndiaSectorCapBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<Level>("sector");
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [industryId, setIndustryId] = useState<string | null>(null);
  const [basicId, setBasicId] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    fetch("/api/sector/india-mcap", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as IndiaSectorCapBook & { error?: string };
        if (!res.ok) throw new Error(body.error ?? `Feed ${res.status}`);
        if (!dead) {
          setBook(body);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!dead) {
          setBook(null);
          setError(err instanceof Error ? err.message : "Sector market-cap feed down");
        }
      })
      .finally(() => {
        if (!dead) setLoading(false);
      });
    return () => {
      dead = true;
    };
  }, []);

  const groups =
    level === "sector" ? book?.sectorRows ?? [] : level === "industry" ? book?.industryRows ?? [] : book?.basicRows ?? [];
  const selectedId = level === "sector" ? sectorId : level === "industry" ? industryId : basicId;

  const scoped = useMemo(() => {
    if (!book) {
      return { industries: [] as IndiaCapGroup[], basics: [] as IndiaCapGroup[], stocks: [] as IndiaListedName[] };
    }
    let stocks = book.stocks;
    if (sectorId) stocks = stocks.filter((row) => row.sector === sectorId);
    if (industryId) stocks = stocks.filter((row) => row.industry === industryId);
    if (basicId) stocks = stocks.filter((row) => row.basic === basicId);
    const totalCap = stocks.reduce((sum, row) => sum + row.marketCap, 0);
    function bucket(key: "industry" | "basic") {
      const by = new Map<string, { names: number; marketCap: number }>();
      for (const row of stocks) {
        const id = row[key];
        const prev = by.get(id) ?? { names: 0, marketCap: 0 };
        prev.names += 1;
        prev.marketCap += row.marketCap;
        by.set(id, prev);
      }
      return [...by.entries()]
        .map(([id, row]) => ({
          id,
          label: id,
          names: row.names,
          marketCap: row.marketCap,
          share: totalCap > 0 ? row.marketCap / totalCap : null,
        }))
        .sort((a, b) => b.marketCap - a.marketCap);
    }
    return { industries: bucket("industry"), basics: bucket("basic"), stocks };
  }, [book, sectorId, industryId, basicId]);

  function openGroup(id: string) {
    if (level === "sector") {
      setSectorId(id);
      setIndustryId(null);
      setBasicId(null);
      return;
    }
    if (level === "industry") {
      const sample = book?.stocks.find((row) => row.industry === id);
      setIndustryId(id);
      setSectorId(sample?.sector ?? null);
      setBasicId(null);
      return;
    }
    const sample = book?.stocks.find((row) => row.basic === id);
    setBasicId(id);
    setIndustryId(sample?.industry ?? null);
    setSectorId(sample?.sector ?? null);
  }

  function backToSectors() {
    setSectorId(null);
    setIndustryId(null);
    setBasicId(null);
    setLevel("sector");
  }

  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
            India · revenue classification
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-xs leading-relaxed">
            {book
              ? `NSE Indices IICS on ${book.universe}: a name sits in the sector that earns more than half of revenue (else Diversified). Defence, Jewellery, Mining, and Sugar are classified on their own first. Then Healthcare → Hospital (treatment), Diagnostic, Pharmaceuticals. ${book.sectors} macro · ${book.industries} sectors · ${book.basics} basic industries · ${book.names} names.`
              : "Classified by major revenue, then the specific line (treatment, diagnostic, and so on)."}
          </p>
        </div>
        <FeedSource>NSE Indices · TradingView</FeedSource>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading sector market caps…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : book ? (
        <>
          <div className="border-border/60 bg-background sticky top-[var(--desk-nav-h,3.5rem)] z-40 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b px-4 py-2 md:-mx-8 md:px-8">
            <button
              type="button"
              onClick={backToSectors}
              className={cn(
                "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
                !sectorId && !industryId && !basicId && level === "sector"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/25 text-muted-foreground hover:border-primary/50",
              )}
            >
              Sectors (macro)
            </button>
            <button
              type="button"
              onClick={() => {
                setLevel("industry");
                setSectorId(null);
                setIndustryId(null);
                setBasicId(null);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
                !sectorId && !industryId && !basicId && level === "industry"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/25 text-muted-foreground hover:border-primary/50",
              )}
            >
              Sectors
            </button>
            <button
              type="button"
              onClick={() => {
                setLevel("basic");
                setSectorId(null);
                setIndustryId(null);
                setBasicId(null);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
                !sectorId && !industryId && !basicId && level === "basic"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/25 text-muted-foreground hover:border-primary/50",
              )}
            >
              Basic industry
            </button>
            {THEME_PILLS.map((pill) => (
              <button
                key={pill.industry}
                type="button"
                onClick={() => {
                  setLevel("industry");
                  setSectorId(pill.sector);
                  setIndustryId(pill.industry);
                  setBasicId(null);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
                  industryId === pill.industry && !basicId
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary/25 text-muted-foreground hover:border-primary/50",
                )}
              >
                {pill.label}
              </button>
            ))}
            {sectorId ? (
              <button
                type="button"
                onClick={() => {
                  setIndustryId(null);
                  setBasicId(null);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
                  !industryId && !basicId ? "border-primary bg-primary text-primary-foreground" : "border-primary/25 text-muted-foreground",
                )}
              >
                {sectorId}
              </button>
            ) : null}
            {industryId ? (
              <button
                type="button"
                onClick={() => setBasicId(null)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
                  !basicId ? "border-primary bg-primary text-primary-foreground" : "border-primary/25 text-muted-foreground",
                )}
              >
                {industryId}
              </button>
            ) : null}
            {basicId ? (
              <span className="rounded-full border border-primary bg-primary px-3 py-1 text-xs tracking-wide text-primary-foreground uppercase">
                {basicId}
              </span>
            ) : null}
          </div>
          <p className="mb-4 font-mono text-sm tabular-nums">
            {book.sectors} macro · {book.industries} sectors · {book.basics} basic · {capLabel(book.marketCap)} total
          </p>

          {!selectedId && !sectorId ? (
            <GroupTable
              rows={groups}
              nameLabel={level === "sector" ? "Macro-economic sector" : level === "industry" ? "Sector" : "Basic industry"}
              onOpen={openGroup}
            />
          ) : null}

          {sectorId && !industryId && !basicId ? (
            <div className="space-y-8">
              <div>
                <h3 className="text-muted-foreground mb-3 text-[10px] tracking-[0.18em] uppercase">
                  Sectors in {sectorId}
                </h3>
                <GroupTable
                  rows={scoped.industries}
                  nameLabel="Sector"
                  onOpen={(id) => {
                    setIndustryId(id);
                    setBasicId(null);
                  }}
                />
              </div>
              <div>
                <h3 className="text-muted-foreground mb-3 text-[10px] tracking-[0.18em] uppercase">
                  Basic industry in {sectorId}
                </h3>
                <GroupTable rows={scoped.basics} nameLabel="Basic industry" onOpen={(id) => setBasicId(id)} />
              </div>
              <StockTable stocks={scoped.stocks} />
            </div>
          ) : null}

          {industryId && !basicId ? (
            <div className="space-y-8">
              {book.themeIndexes?.[industryId] ? (
                <ThemeIndexTable index={book.themeIndexes[industryId]} theme={industryId} />
              ) : industryId === "Defence" && book.defenceIndex ? (
                <ThemeIndexTable index={book.defenceIndex} theme="Defence" />
              ) : null}
              <div>
                <h3 className="text-muted-foreground mb-3 text-[10px] tracking-[0.18em] uppercase">
                  Basic industry in {industryId}
                </h3>
                <GroupTable rows={scoped.basics} nameLabel="Basic industry" onOpen={(id) => setBasicId(id)} />
              </div>
              <StockTable stocks={scoped.stocks} />
            </div>
          ) : null}

          {basicId ? <StockTable stocks={scoped.stocks} /> : null}
        </>
      ) : null}
    </section>
  );
}

type SortDir = "asc" | "desc";

function toggleSort<K extends string>(prev: { key: K; dir: SortDir }, key: K, defaultDir: SortDir): { key: K; dir: SortDir } {
  if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
  return { key, dir: defaultDir };
}

function mark(active: boolean, dir: SortDir) {
  if (!active) return "";
  return dir === "asc" ? " ↑" : " ↓";
}

function SortBtn({
  label,
  active,
  dir,
  align,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  align?: "right";
  onClick: () => void;
}) {
  return (
    <button type="button" className={cn("font-medium uppercase", align === "right" && "w-full text-right")} onClick={onClick}>
      {label}
      {mark(active, dir)}
    </button>
  );
}

function GroupTable({
  rows,
  nameLabel,
  onOpen,
}: {
  rows: IndiaCapGroup[];
  nameLabel: string;
  onOpen: (id: string) => void;
}) {
  const [sort, setSort] = useState<{ key: "label" | "names" | "marketCap" | "share"; dir: SortDir }>({
    key: "marketCap",
    dir: "desc",
  });
  const ranked = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sort.key === "label") return a.label.localeCompare(b.label);
      if (sort.key === "names") return a.names - b.names;
      if (sort.key === "share") return (a.share ?? 0) - (b.share ?? 0);
      return a.marketCap - b.marketCap;
    });
    if (sort.dir === "desc") copy.reverse();
    return copy;
  }, [rows, sort]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-[10px] tracking-[0.16em] uppercase">Sort</span>
        {(
          [
            ["marketCap", "Market cap"],
            ["names", "Names"],
            ["label", "A–Z"],
            ["share", "Share"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort((prev) => toggleSort(prev, key, key === "label" ? "asc" : "desc"))}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10px] tracking-wide uppercase",
              sort.key === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-primary/25 text-muted-foreground hover:border-primary/50",
            )}
          >
            {label}
            {sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl bg-card text-foreground">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-3 py-2">
                <SortBtn
                  label={nameLabel}
                  active={sort.key === "label"}
                  dir={sort.dir}
                  onClick={() => setSort((prev) => toggleSort(prev, "label", "asc"))}
                />
              </th>
              <th className="px-3 py-2 text-right">
                <SortBtn
                  label="Names"
                  active={sort.key === "names"}
                  dir={sort.dir}
                  align="right"
                  onClick={() => setSort((prev) => toggleSort(prev, "names", "desc"))}
                />
              </th>
              <th className="px-3 py-2 text-right">
                <SortBtn
                  label="Market cap"
                  active={sort.key === "marketCap"}
                  dir={sort.dir}
                  align="right"
                  onClick={() => setSort((prev) => toggleSort(prev, "marketCap", "desc"))}
                />
              </th>
              <th className="px-4 py-2 text-right">
                <SortBtn
                  label="Share"
                  active={sort.key === "share"}
                  dir={sort.dir}
                  align="right"
                  onClick={() => setSort((prev) => toggleSort(prev, "share", "desc"))}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row, i) => (
              <tr key={row.id} className="border-b border-border/50 last:border-0">
                <td className="text-muted-foreground px-4 py-2 font-mono text-xs tabular-nums">{i + 1}</td>
                <td className="px-3 py-2">
                  <button type="button" className="text-left hover:underline" onClick={() => onOpen(row.id)}>
                    {row.label}
                  </button>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{row.names}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{capLabel(row.marketCap)}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {row.share == null ? "—" : formatPct(row.share)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockTable({ stocks }: { stocks: IndiaListedName[] }) {
  const [sort, setSort] = useState<{ key: "symbol" | "name" | "industry" | "basic" | "marketCap"; dir: SortDir }>({
    key: "marketCap",
    dir: "desc",
  });
  const ranked = useMemo(() => {
    const copy = [...stocks];
    copy.sort((a, b) => {
      if (sort.key === "symbol") return a.symbol.localeCompare(b.symbol);
      if (sort.key === "name") return a.name.localeCompare(b.name);
      if (sort.key === "industry") return a.industry.localeCompare(b.industry);
      if (sort.key === "basic") return a.basic.localeCompare(b.basic);
      return a.marketCap - b.marketCap;
    });
    if (sort.dir === "desc") copy.reverse();
    return copy;
  }, [stocks, sort]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-muted-foreground text-[10px] tracking-[0.18em] uppercase">
          Stocks · {stocks.length} names
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-[10px] tracking-[0.16em] uppercase">Sort</span>
          {(
            [
              ["marketCap", "Market cap"],
              ["symbol", "Symbol"],
              ["name", "Name"],
              ["industry", "Sector"],
              ["basic", "Basic"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort((prev) => toggleSort(prev, key, key === "marketCap" ? "desc" : "asc"))}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] tracking-wide uppercase",
                sort.key === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/25 text-muted-foreground hover:border-primary/50",
              )}
            >
              {label}
              {sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[32rem] overflow-auto rounded-xl bg-card text-foreground">
        <table className="w-full text-sm">
          <thead className="bg-card sticky top-0">
            <tr className="border-b border-border text-left text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-3 py-2">
                <SortBtn
                  label="Symbol"
                  active={sort.key === "symbol"}
                  dir={sort.dir}
                  onClick={() => setSort((prev) => toggleSort(prev, "symbol", "asc"))}
                />
              </th>
              <th className="px-3 py-2">
                <SortBtn
                  label="Name"
                  active={sort.key === "name"}
                  dir={sort.dir}
                  onClick={() => setSort((prev) => toggleSort(prev, "name", "asc"))}
                />
              </th>
              <th className="px-3 py-2">
                <SortBtn
                  label="Sector"
                  active={sort.key === "industry"}
                  dir={sort.dir}
                  onClick={() => setSort((prev) => toggleSort(prev, "industry", "asc"))}
                />
              </th>
              <th className="px-3 py-2">
                <SortBtn
                  label="Basic industry"
                  active={sort.key === "basic"}
                  dir={sort.dir}
                  onClick={() => setSort((prev) => toggleSort(prev, "basic", "asc"))}
                />
              </th>
              <th className="px-4 py-2 text-right">
                <SortBtn
                  label="Market cap"
                  active={sort.key === "marketCap"}
                  dir={sort.dir}
                  align="right"
                  onClick={() => setSort((prev) => toggleSort(prev, "marketCap", "desc"))}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row, i) => (
              <tr key={row.symbol} className="border-b border-border/50 last:border-0">
                <td className="text-muted-foreground px-4 py-2 font-mono text-xs tabular-nums">{i + 1}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.symbol}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="text-muted-foreground px-3 py-2 text-xs">{row.industry}</td>
                <td className="px-3 py-2 text-xs">{row.basic}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">{capLabel(row.marketCap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function weightPct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

function ThemeIndexTable({ index, theme }: { index: ThemeIndex; theme: string }) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-muted-foreground text-[10px] tracking-[0.18em] uppercase">
          {index.name} · {index.size} names · base {index.base}
        </h3>
        <p className="text-muted-foreground mt-1 max-w-2xl text-xs leading-relaxed">
          {index.formula}. Basket {capLabel(index.marketCap)}.
        </p>
      </div>
      <div className="mb-6">
        <DefenceIndexCandle key={theme} theme={theme} />
      </div>
      <div className="overflow-x-auto rounded-xl bg-card text-foreground">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Symbol</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Line</th>
              <th className="px-3 py-2 text-right font-medium">Market cap</th>
              <th className="px-3 py-2 text-right font-medium">Raw</th>
              <th className="px-3 py-2 text-right font-medium">Index wt</th>
              <th className="px-4 py-2 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {index.constituents.map((row) => (
              <tr key={row.symbol} className="border-b border-border/50 last:border-0">
                <td className="text-muted-foreground px-4 py-2 font-mono text-xs tabular-nums">{row.rank}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.symbol}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="text-muted-foreground px-3 py-2 text-xs">{row.basic}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{capLabel(row.marketCap)}</td>
                <td className="text-muted-foreground px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {weightPct(row.rawWeight)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{weightPct(row.weight)}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">{row.points.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
