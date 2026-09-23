"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";
import { FeedSource } from "@/components/desk/feed-source";
import { formatPct, pnlClass } from "@/lib/format";
import type { SectorMarket } from "@/lib/markets/sector-returns";
import type { VixRegime } from "@/lib/markets/sector-signals";

type RankedRow = {
  sector: string;
  yahoo: string;
  sleeve: "cyclical" | "defensive";
  mom6: number | null;
  mom12: number | null;
  rank: number;
  inBook: boolean;
};

type Payload = {
  asOf: string;
  live: number;
  total: number;
  benchmark: string;
  vixYahoo: string;
  absMom: number | null;
  riskOn: boolean;
  vix: number | null;
  regime: VixRegime | null;
  ranked: RankedRow[];
  hold: string[];
  note: string;
  error?: string;
};

function regimeLabel(regime: VixRegime | null) {
  if (regime === "low") return "Low vol — cyclicals";
  if (regime === "high") return "High vol — defensives";
  if (regime === "mid") return "Mid vol — no overlay";
  return "Vol unread";
}

export function SectorLiveBook({ market }: { market: SectorMarket }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    setError(null);
    fetch(`/api/sector/signals?market=${market}`)
      .then(async (res) => {
        const body = (await res.json()) as Payload;
        if (!res.ok) throw new Error(body.error ?? `Feed ${res.status}`);
        if (!dead) setData(body);
      })
      .catch((err: unknown) => {
        if (!dead) {
          setData(null);
          setError(err instanceof Error ? err.message : "Signal feed down");
        }
      })
      .finally(() => {
        if (!dead) setLoading(false);
      });
    return () => {
      dead = true;
    };
  }, [market]);

  return (
    <section>
      <div className="mb-5 flex items-start justify-between gap-3">
        <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
          Required book · 6-month momentum
        </h2>
        <FeedSource>Yahoo</FeedSource>
      </div>
      {loading ? (
        <p className="text-muted-foreground text-sm">Pulling live sector paths…</p>
      ) : error ? (
        <p className="text-loss text-sm">{error}</p>
      ) : data ? (
        <LiveBody data={data} />
      ) : null}
    </section>
  );
}

function LiveBody({ data }: { data: Payload }) {
  return (
    <>
      <div className="border-border mb-6 grid gap-6 border-y py-8 md:grid-cols-3">
        <div>
          <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">
            12-month gate · {data.benchmark}
          </p>
          <p className={cn("mt-2 font-heading text-2xl", data.riskOn ? "text-gain" : "text-loss")}>
            {data.riskOn ? "Risk on" : "Cash"}
          </p>
          <p className={`mt-1 font-mono text-lg tabular-nums ${pnlClass(data.absMom ?? 0)}`}>
            {data.absMom == null ? "—" : formatPct(data.absMom)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">Antonacci absolute momentum. Below zero → no sector book.</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">
            Vol overlay · {data.vixYahoo}
          </p>
          <p className="mt-2 font-heading text-2xl">{regimeLabel(data.regime)}</p>
          <p className="mt-1 font-mono text-lg tabular-nums">
            {data.vix == null ? "—" : data.vix.toFixed(2)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">Low &lt; 20 keeps cyclicals. High &gt; 25 switches to defensives.</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">Hold (equal weight)</p>
          <p className="mt-2 font-heading text-2xl">
            {data.hold.length ? data.hold.join(" · ") : "Cash"}
          </p>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{data.note}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-max min-w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-border border-b text-left text-[10px] tracking-[0.18em] uppercase">
              <th className="pb-3 pr-3 font-medium">#</th>
              <th className="pb-3 pr-4 font-medium">Sector</th>
              <th className="pb-3 pr-4 font-medium">Sleeve</th>
              <th className="pb-3 pr-3 text-right font-medium">6m skip-1m</th>
              <th className="pb-3 pr-3 text-right font-medium">12m</th>
              <th className="pb-3 font-medium">Book</th>
            </tr>
          </thead>
          <tbody>
            {data.ranked.map((row) => (
              <tr key={row.sector} className="border-border/60 border-b last:border-0">
                <td className="text-muted-foreground py-2.5 pr-3 font-mono text-xs">
                  {row.rank || "—"}
                </td>
                <td className="py-2.5 pr-4">
                  <div>{row.sector}</div>
                  <div className="text-muted-foreground font-mono text-[10px]">{row.yahoo}</div>
                </td>
                <td className="text-muted-foreground py-2.5 pr-4">{row.sleeve}</td>
                <td className={`py-2.5 pr-3 text-right font-mono tabular-nums ${pnlClass(row.mom6 ?? 0)}`}>
                  {row.mom6 == null ? "—" : formatPct(row.mom6)}
                </td>
                <td className={`py-2.5 pr-3 text-right font-mono tabular-nums ${pnlClass(row.mom12 ?? 0)}`}>
                  {row.mom12 == null ? "—" : formatPct(row.mom12)}
                </td>
                <td className={cn("py-2.5 font-mono text-xs uppercase", row.inBook ? "text-gain" : "text-muted-foreground")}>
                  {row.inBook ? "Hold" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        Live Yahoo closes. Formation is 126 sessions, skipping the last 21 (Moskowitz–Grinblatt +
        Jegadeesh–Titman skip-month). {data.live} of {data.total} sleeves printed. Not a recommendation.
      </p>
    </>
  );
}
