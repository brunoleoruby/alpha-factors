"use client";

import { useEffect, useMemo, useState } from "react";
import { FeedSource } from "@/components/desk/feed-source";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import {
  sleeveCounts,
  type IpoBoardKind,
  type IpoBook,
  type IpoIssue,
  type IpoSleeve,
} from "@/lib/markets/nse-ipo";
import { cn } from "cn";

const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

function issueDay(raw: string | null) {
  if (!raw) return "—";
  const iso = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const m = raw.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/i);
  if (m) {
    const mm = MONTHS[m[2][0].toUpperCase() + m[2].slice(1, 3).toLowerCase()];
    if (mm) return `${m[1].padStart(2, "0")}-${mm}-${m[3]}`;
  }
  return formatDate(raw);
}

function subscribed(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toFixed(2)}×`;
}

function needle(raw: string) {
  return raw.trim().toLowerCase();
}

function hitIssue(row: IpoIssue, name: string, symbol: string, sector: string) {
  if (name && !row.name.toLowerCase().includes(name)) return false;
  if (symbol && !(row.symbol ?? "").toLowerCase().includes(symbol)) return false;
  const sec = (row.sector ?? "").toLowerCase();
  if (sector && sector !== "all" && !sec.includes(sector)) return false;
  return true;
}

function filterSleeve(sleeve: IpoSleeve, name: string, symbol: string, sector: string): IpoSleeve {
  const n = needle(name);
  const s = needle(symbol);
  const c = needle(sector);
  const keep = (row: IpoIssue) => hitIssue(row, n, s, c);
  return {
    open: sleeve.open.filter(keep),
    upcoming: sleeve.upcoming.filter(keep),
    recent: sleeve.recent.filter(keep),
  };
}

function sectorOptions(sleeve: IpoSleeve | undefined) {
  if (!sleeve) return [];
  const set = new Set<string>();
  for (const row of [...sleeve.open, ...sleeve.upcoming, ...sleeve.recent]) {
    const v = (row.sector ?? "").trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

type SortKey = "name" | "symbol" | "sector" | "subscribed" | "qib" | "nii" | "retail" | "start" | "end" | "listing";
type SortState = { key: SortKey; dir: "asc" | "desc" };

function stamp(raw: string | null) {
  if (!raw) return 0;
  const iso = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const m = raw.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/i);
  if (m) {
    const mm = MONTHS[m[2][0].toUpperCase() + m[2].slice(1, 3).toLowerCase()];
    if (mm) return Date.UTC(Number(m[3]), Number(mm) - 1, Number(m[1]));
  }
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

function sortValue(row: IpoIssue, key: SortKey): string | number {
  switch (key) {
    case "name":
      return row.name;
    case "symbol":
      return row.symbol ?? "";
    case "sector":
      return row.sector ?? "";
    case "subscribed":
      return row.subscribed ?? -1;
    case "qib":
      return row.qib ?? -1;
    case "nii":
      return row.nii ?? -1;
    case "retail":
      return row.retail ?? -1;
    case "start":
      return stamp(row.start);
    case "end":
      return stamp(row.end);
    case "listing":
      return stamp(row.listing);
  }
}

function sortRows(rows: IpoIssue[], sort: SortState) {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = sortValue(a, sort.key);
    const bv = sortValue(b, sort.key);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { sensitivity: "base" }) * dir;
  });
}

function sortSleeve(sleeve: IpoSleeve, sort: SortState): IpoSleeve {
  return {
    open: sortRows(sleeve.open, sort),
    upcoming: sortRows(sleeve.upcoming, sort),
    recent: sortRows(sleeve.recent, sort),
  };
}

function SortHead({
  label,
  column,
  sort,
  onSort,
  align,
}: {
  label: string;
  column: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  align?: "right";
}) {
  const active = sort.key === column;
  return (
    <th className={cn("pb-2 pr-3 font-medium", align === "right" && "text-right", column === "listing" && "pr-3")}>
      <button
        type="button"
        className={cn("hover:text-foreground tracking-[0.16em] uppercase", active ? "text-foreground" : "text-muted-foreground")}
        onClick={() => onSort(column)}
      >
        {label}
        {active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

function Table({
  rows,
  sort,
  onSort,
}: {
  rows: IpoIssue[];
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[8%]" />
          <col className="w-[13%]" />
          <col className="w-[7%]" />
          <col className="w-[6%]" />
          <col className="w-[6%]" />
          <col className="w-[7%]" />
          <col className="w-[11%]" />
          <col className="w-[9%]" />
          <col className="w-[9%]" />
          <col className="w-[8%]" />
        </colgroup>
        <thead>
          <tr className="text-muted-foreground border-b text-[10px] tracking-[0.16em] uppercase">
            <SortHead label="Name" column="name" sort={sort} onSort={onSort} />
            <SortHead label="Symbol" column="symbol" sort={sort} onSort={onSort} />
            <SortHead label="Sector" column="sector" sort={sort} onSort={onSort} />
            <SortHead label="Total" column="subscribed" sort={sort} onSort={onSort} align="right" />
            <SortHead label="QIB" column="qib" sort={sort} onSort={onSort} align="right" />
            <SortHead label="NII" column="nii" sort={sort} onSort={onSort} align="right" />
            <SortHead label="Retail" column="retail" sort={sort} onSort={onSort} align="right" />
            <th className="pb-2 pr-3 font-medium">Price</th>
            <SortHead label="Opens" column="start" sort={sort} onSort={onSort} />
            <SortHead label="Closes" column="end" sort={sort} onSort={onSort} />
            <SortHead label="Lists" column="listing" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id} className="border-border/50 border-b last:border-0">
                <td className="py-2 pr-3 font-medium break-words">{row.name}</td>
                <td className="text-muted-foreground py-2 pr-3 font-mono text-[12px]">{row.symbol}</td>
                <td className="text-muted-foreground py-2 pr-3 text-[12px] break-words">{row.sector ?? "—"}</td>
                <td className="py-2 pr-3 text-right font-mono text-[12px] whitespace-nowrap tabular-nums">
                  {subscribed(row.subscribed)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-[12px] whitespace-nowrap tabular-nums">
                  {subscribed(row.qib)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-[12px] whitespace-nowrap tabular-nums">
                  {subscribed(row.nii)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-[12px] whitespace-nowrap tabular-nums">
                  {subscribed(row.retail)}
                </td>
                <td className="py-2 pr-3 font-mono text-[12px] whitespace-nowrap">{row.price ?? "—"}</td>
                <td className="py-2 pr-3 font-mono text-[12px] whitespace-nowrap tabular-nums">{issueDay(row.start)}</td>
                <td className="py-2 pr-3 font-mono text-[12px] whitespace-nowrap tabular-nums">{issueDay(row.end)}</td>
                <td className="py-2 pr-3 font-mono text-[12px] whitespace-nowrap tabular-nums">{issueDay(row.listing)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={11} className="text-muted-foreground py-3 text-sm">
                None on this tape.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Board({
  title,
  blurb,
  source,
  sleeve,
  loading,
  sort,
  onSort,
}: {
  title: string;
  blurb: string;
  source: string;
  sleeve: IpoSleeve | undefined;
  loading: boolean;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  return (
    <section className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="text-muted-foreground mt-1 text-xs">{blurb}</p>
          {sleeve ? (
            <p className="text-muted-foreground mt-1 font-mono text-[11px]">{sleeveCounts(sleeve)}</p>
          ) : null}
        </div>
        <FeedSource>{source}</FeedSource>
      </div>
      <Card className="border-primary/15 bg-card/90">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Open now</CardTitle>
          <CardAction>
            <FeedSource>Chittorgarh</FeedSource>
          </CardAction>
          <CardDescription className="text-xs">
            Bid window live. Total / QIB / NII / Retail from Chittorgarh (BSE + NSE combined).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !sleeve ? <p className="text-muted-foreground text-sm">…</p> : <Table rows={sleeve?.open ?? []} sort={sort} onSort={onSort} />}
        </CardContent>
      </Card>
      <Card className="border-primary/15 bg-card/90">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Upcoming</CardTitle>
          <CardAction>
            <FeedSource>Chittorgarh</FeedSource>
          </CardAction>
          <CardDescription className="text-xs">Filed, not yet in the bid window.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table rows={sleeve?.upcoming ?? []} sort={sort} onSort={onSort} />
        </CardContent>
      </Card>
      <Card className="border-primary/15 bg-card/90">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent</CardTitle>
          <CardAction>
            <FeedSource>Chittorgarh</FeedSource>
          </CardAction>
          <CardDescription className="text-xs">Closed or listed in the last 90 days.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table rows={sleeve?.recent ?? []} sort={sort} onSort={onSort} />
        </CardContent>
      </Card>
    </section>
  );
}

export function IpoBoard() {
  const [book, setBook] = useState<IpoBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<IpoBoardKind>("main");
  const [nameQ, setNameQ] = useState("");
  const [symbolQ, setSymbolQ] = useState("");
  const [sectorQ, setSectorQ] = useState("all");
  const [sort, setSort] = useState<SortState>({ key: "name", dir: "asc" });

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("board");
      if (q === "sme") setBoard("sme");
    } catch {
      /* ignore */
    }
  }, []);

  function selectBoard(next: IpoBoardKind) {
    setBoard(next);
    const url = next === "sme" ? "/ipo?board=sme" : "/ipo";
    window.history.replaceState(null, "", url);
  }

  useEffect(() => {
    let dead = false;
    let follow = true;
    const load = async (scrape?: boolean) => {
      try {
        const res = await fetch(scrape ? "/api/ipo?sectors=1" : "/api/ipo", { cache: "no-store" });
        const body = (await res.json()) as IpoBook & { error?: string };
        if (!res.ok && !body.main?.open?.length && !body.sme?.open?.length) {
          throw new Error(body.error ?? `IPO ${res.status}`);
        }
        if (dead) return;
        setBook(body);
        setError(body.error ?? null);
        if (!scrape && follow) {
          follow = false;
          void load(true);
        }
      } catch (err) {
        if (!dead && !scrape) setError(err instanceof Error ? err.message : "IPO feed down");
      } finally {
        if (!dead && !scrape) setLoading(false);
      }
    };
    void load();
    const t = setInterval(() => void load(), 120_000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, []);

  const smeOn = board === "sme";
  const rawSleeve = smeOn ? book?.sme : book?.main;
  const sectors = useMemo(() => sectorOptions(rawSleeve), [rawSleeve]);
  useEffect(() => {
    if (sectorQ !== "all" && !sectors.includes(sectorQ)) setSectorQ("all");
  }, [sectors, sectorQ]);
  const sleeve = useMemo(() => {
    if (!rawSleeve) return undefined;
    return sortSleeve(filterSleeve(rawSleeve, nameQ, symbolQ, sectorQ), sort);
  }, [rawSleeve, nameQ, symbolQ, sectorQ, sort]);

  function onSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "symbol" || key === "sector" ? "asc" : "desc" },
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 pb-10 md:px-6">
      <header className="mt-2">
        <p className="text-primary text-xs font-medium tracking-[0.22em] uppercase">Varun G V · personal</p>
        <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight md:text-4xl">IPO</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
          Same page, two tapes. Click Main IPO or SME IPO — only that list opens. Calendar,
          subscription, and sector from Chittorgarh. Delayed, not a recommendation.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectBoard("main")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
                !smeOn
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/25 text-muted-foreground hover:border-primary/50",
              )}
            >
              Main IPO
            </button>
            <button
              type="button"
              onClick={() => selectBoard("sme")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
                smeOn
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/25 text-muted-foreground hover:border-primary/50",
              )}
            >
              SME IPO
            </button>
          </div>
          <FeedSource>Chittorgarh</FeedSource>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block min-w-0">
            <span className="text-muted-foreground mb-1 block text-[10px] tracking-[0.16em] uppercase">Name</span>
            <Input value={nameQ} onChange={(e) => setNameQ(e.target.value)} placeholder="Filter name" />
          </label>
          <label className="block min-w-0">
            <span className="text-muted-foreground mb-1 block text-[10px] tracking-[0.16em] uppercase">Symbol</span>
            <Input value={symbolQ} onChange={(e) => setSymbolQ(e.target.value)} placeholder="Filter symbol" />
          </label>
          <label className="block min-w-0">
            <span className="text-muted-foreground mb-1 block text-[10px] tracking-[0.16em] uppercase">Sector</span>
            <select
              value={sectorQ}
              onChange={(e) => setSectorQ(e.target.value)}
              className="border-input bg-transparent dark:bg-input/30 h-8 w-full rounded-lg border px-2.5 text-sm"
            >
              <option value="all">All sectors</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="text-muted-foreground mb-1 block text-[10px] tracking-[0.16em] uppercase">Sort</span>
            <div className="flex gap-2">
              <select
                value={sort.key}
                onChange={(e) => {
                  const key = e.target.value as SortKey;
                  setSort((prev) => ({
                    key,
                    dir:
                      prev.key === key
                        ? prev.dir
                        : key === "name" || key === "symbol" || key === "sector"
                          ? "asc"
                          : "desc",
                  }));
                }}
                className="border-input bg-transparent dark:bg-input/30 h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-sm"
              >
                <option value="name">Name</option>
                <option value="symbol">Symbol</option>
                <option value="sector">Sector</option>
                <option value="subscribed">Total</option>
                <option value="start">Opens</option>
                <option value="end">Closes</option>
              </select>
              <button
                type="button"
                onClick={() => setSort((prev) => ({ ...prev, dir: prev.dir === "asc" ? "desc" : "asc" }))}
                className="border-input h-8 shrink-0 rounded-lg border px-2.5 text-xs tracking-wide uppercase"
              >
                {sort.key === "name" || sort.key === "symbol" || sort.key === "sector"
                  ? sort.dir === "asc"
                    ? "A → Z"
                    : "Z → A"
                  : sort.dir === "asc"
                    ? "Low → High"
                    : "High → Low"}
              </button>
            </div>
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {loading ? <Badge variant="outline">Reading feeds</Badge> : <Badge variant="outline">Chittorgarh</Badge>}
          {sleeve ? <Badge variant="outline">{sleeveCounts(sleeve)}</Badge> : null}
          {error ? <Badge variant="destructive">{error}</Badge> : null}
        </div>
      </header>

      <Board
        title={smeOn ? "SME IPO" : "Mainboard IPO"}
        blurb={smeOn ? "SME issues from Chittorgarh." : "Mainboard issues from Chittorgarh."}
        source="Chittorgarh"
        sleeve={sleeve}
        loading={loading}
        sort={sort}
        onSort={onSort}
      />
    </div>
  );
}
