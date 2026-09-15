"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const m = raw.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/i);
  if (m) {
    const mm = MONTHS[m[2][0].toUpperCase() + m[2].slice(1, 3).toLowerCase()];
    if (mm) return `${m[1].padStart(2, "0")}-${mm}-${m[3]}`;
  }
  return formatDate(raw);
}

function shares(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function subscribed(n: number | null) {
  if (n == null) return "—";
  return `${n.toFixed(2)}×`;
}

function Table({ rows, listing }: { rows: IpoIssue[]; listing?: boolean }) {
  if (!rows.length) {
    return <p className="text-muted-foreground text-sm">None on this tape.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-[10px] tracking-[0.16em] uppercase">
            <th className="pb-2 pr-3 font-medium">Name</th>
            <th className="pb-2 pr-3 font-medium">Symbol</th>
            <th className="pb-2 pr-3 font-medium">Price</th>
            <th className="pb-2 pr-3 font-medium">Opens</th>
            <th className="pb-2 pr-3 font-medium">Closes</th>
            {listing ? <th className="pb-2 pr-3 font-medium">Lists</th> : null}
            <th className="pb-2 pr-3 text-right font-medium">Shares</th>
            <th className="pb-2 text-right font-medium">Sub</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-border/50 border-b last:border-0">
              <td className="py-2 pr-3 font-medium">{row.name}</td>
              <td className="text-muted-foreground py-2 pr-3 font-mono text-[12px]">{row.symbol}</td>
              <td className="py-2 pr-3 font-mono text-[12px] whitespace-nowrap">{row.price ?? "—"}</td>
              <td className="py-2 pr-3 font-mono text-[12px] whitespace-nowrap">{issueDay(row.start)}</td>
              <td className="py-2 pr-3 font-mono text-[12px] whitespace-nowrap">{issueDay(row.end)}</td>
              {listing ? (
                <td className="py-2 pr-3 font-mono text-[12px] whitespace-nowrap">{issueDay(row.listing)}</td>
              ) : null}
              <td className="py-2 pr-3 text-right font-mono text-[12px] tabular-nums">{shares(row.shares)}</td>
              <td className="py-2 text-right font-mono text-[12px] tabular-nums">{subscribed(row.subscribed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Board({
  title,
  blurb,
  sleeve,
  loading,
}: {
  title: string;
  blurb: string;
  sleeve: IpoSleeve | undefined;
  loading: boolean;
}) {
  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-1 text-xs">{blurb}</p>
        {sleeve ? (
          <p className="text-muted-foreground mt-1 font-mono text-[11px]">{sleeveCounts(sleeve)}</p>
        ) : null}
      </div>
      <Card className="border-primary/15 bg-card/90">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Open now</CardTitle>
          <CardDescription className="text-xs">Subscription window is live.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !sleeve ? <p className="text-muted-foreground text-sm">…</p> : <Table rows={sleeve?.open ?? []} />}
        </CardContent>
      </Card>
      <Card className="border-primary/15 bg-card/90">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Upcoming</CardTitle>
          <CardDescription className="text-xs">Filed, not yet in the bid window.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table rows={sleeve?.upcoming ?? []} />
        </CardContent>
      </Card>
      <Card className="border-primary/15 bg-card/90">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent</CardTitle>
          <CardDescription className="text-xs">Closed or listed in the last 90 days.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table rows={sleeve?.recent ?? []} listing />
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
    const load = async () => {
      try {
        const res = await fetch("/api/ipo", { cache: "no-store" });
        const body = (await res.json()) as IpoBook & { error?: string };
        if (!res.ok && !body.main?.open?.length && !body.sme?.open?.length) {
          throw new Error(body.error ?? `IPO ${res.status}`);
        }
        if (dead) return;
        setBook(body);
        setError(body.error ?? null);
      } catch (err) {
        if (!dead) setError(err instanceof Error ? err.message : "IPO feed down");
      } finally {
        if (!dead) setLoading(false);
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
  const sleeve = smeOn ? book?.sme : book?.main;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 pb-10 md:px-6">
      <header className="mt-2">
        <p className="text-primary text-xs font-medium tracking-[0.22em] uppercase">Varun G V · personal</p>
        <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight md:text-4xl">IPO</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
          Same page, two tapes. Click Main IPO or SME IPO — only that list opens. Delayed exchange
          calendar, not a recommendation.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
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
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {loading ? <Badge variant="outline">Reading NSE</Badge> : <Badge variant="outline">NSE</Badge>}
          {sleeve ? <Badge variant="outline">{sleeveCounts(sleeve)}</Badge> : null}
          {error ? <Badge variant="destructive">{error}</Badge> : null}
        </div>
      </header>

      <Board
        title={smeOn ? "SME IPO" : "Mainboard IPO"}
        blurb={smeOn ? "NSE Emerge / SME issues only." : "EQ cash issues on the main board."}
        sleeve={sleeve}
        loading={loading}
      />
    </div>
  );
}
