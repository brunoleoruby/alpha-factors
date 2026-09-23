"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPct, pnlClass } from "@/lib/format";
import {
  breadthTone,
  type BreadthSlice,
  type MaTape,
  type NseBreadth,
} from "@/lib/markets/nse-breadth";
import { cn } from "cn";

function share(n: number, total: number) {
  if (total <= 0) return 0;
  return (n / total) * 100;
}

function AdBar({ row }: { row: BreadthSlice }) {
  const a = share(row.advances, row.total);
  const u = share(row.unchanged, row.total);
  const d = share(row.declines, row.total);
  return (
    <div className="bg-muted flex h-2 w-full overflow-hidden rounded-full">
      <div className="bg-gain h-full" style={{ width: `${a}%` }} />
      <div className="bg-muted-foreground/30 h-full" style={{ width: `${u}%` }} />
      <div className="bg-loss h-full" style={{ width: `${d}%` }} />
    </div>
  );
}

function MaBar({ tape }: { tape: MaTape }) {
  const a = share(tape.above, tape.total);
  const b = share(tape.below, tape.total);
  return (
    <div className="bg-muted flex h-2 w-full overflow-hidden rounded-full">
      <div className="bg-gain h-full" style={{ width: `${a}%` }} />
      <div className="bg-loss h-full" style={{ width: `${b}%` }} />
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-[10px] tracking-[0.16em] uppercase">{label}</p>
      <p className={cn("font-mono text-lg font-semibold tabular-nums", className)}>{value}</p>
    </div>
  );
}

function SliceTable({ rows, nameLabel }: { rows: BreadthSlice[]; nameLabel: string }) {
  return (
    <table className="w-full min-w-[32rem] border-separate border-spacing-0 text-left text-sm">
      <thead>
        <tr className="text-muted-foreground border-b text-[10px] tracking-[0.16em] uppercase">
          <th className="pb-2 pr-3 font-medium">{nameLabel}</th>
          <th className="pb-2 pr-2 text-right font-medium">Adv</th>
          <th className="pb-2 pr-2 text-right font-medium">Dec</th>
          <th className="pb-2 pr-3 text-right font-medium">Unch</th>
          <th className="min-w-[6rem] pb-2 pr-3 font-medium">Breadth</th>
          <th className="pb-2 text-right font-medium">Day</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-border/50 border-b last:border-0">
            <td className="py-1.5 pr-3">
              <p className="font-medium">{row.name}</p>
            </td>
            <td className="text-gain py-1.5 pr-2 text-right font-mono tabular-nums">{row.advances}</td>
            <td className="text-loss py-1.5 pr-2 text-right font-mono tabular-nums">{row.declines}</td>
            <td className="text-muted-foreground py-1.5 pr-3 text-right font-mono tabular-nums">
              {row.unchanged}
            </td>
            <td className="min-w-[6rem] py-1.5 pr-3">
              <AdBar row={row} />
            </td>
            <td
              className={cn(
                "py-1.5 text-right font-mono text-[11px] whitespace-nowrap tabular-nums",
                row.changePct != null ? pnlClass(row.changePct) : "text-muted-foreground",
              )}
            >
              {row.changePct != null ? formatPct(row.changePct) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function NseBreadthPanel({
  data,
  loading,
  error,
}: {
  data: NseBreadth | null;
  loading: boolean;
  error: string | null;
}) {
  const ex = data?.exchange;
  const tone = breadthTone(ex?.advanceShare ?? null);
  const ad =
    ex && ex.declines > 0 ? ex.advances / ex.declines : ex && ex.advances > 0 ? Infinity : null;
  const mas = [
    data?.movingAverages?.dma20,
    data?.movingAverages?.dma50,
    data?.movingAverages?.dma200,
  ].filter((t): t is MaTape => t != null);
  const thrust = data?.thrust;

  return (
    <Card className="border-primary/15 bg-card/90">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base leading-tight">NSE market breadth</CardTitle>
            <CardDescription className="text-xs">
              Exchange A/D from NSE Total Market. Thrust and 20/50/200 DMA are the Chartink Atlas
              prints (NSE primary names). Sector rows are official NSE sectoral indices.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-muted-foreground text-[10px] font-medium tracking-[0.16em] uppercase whitespace-nowrap">
              {data?.source === "tradingview" ? "TradingView" : "NSE · Chartink"}
            </span>
            <div className="flex flex-wrap justify-end gap-1.5">
              {loading ? <Badge variant="outline">Reading NSE</Badge> : null}
              {data?.source === "nse" && !error ? <Badge variant="outline">NSE</Badge> : null}
              {thrust ? <Badge variant="outline">DMA / thrust</Badge> : null}
              {data?.source === "tradingview" ? <Badge variant="outline">TV fallback</Badge> : null}
              {error ? <Badge variant="destructive">{error}</Badge> : null}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 pt-0">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
          <div>
            {loading && !ex ? (
              <p className="text-muted-foreground text-sm">…</p>
            ) : !ex ? (
              <p className="text-muted-foreground text-sm">No exchange print yet.</p>
            ) : (
              <>
                <p className="text-muted-foreground mb-1 text-[10px] tracking-[0.18em] uppercase">
                  {ex.name} · {ex.total} names
                </p>
                <p
                  className={cn(
                    "font-heading text-2xl font-semibold",
                    tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-foreground",
                  )}
                >
                  {ex.advanceShare != null ? `${(ex.advanceShare * 100).toFixed(1)}%` : "—"} advancing
                </p>
                <div className="mt-3">
                  <AdBar row={ex} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Advances" value={String(ex.advances)} className="text-gain" />
                  <Stat label="Declines" value={String(ex.declines)} className="text-loss" />
                  <Stat label="Unchanged" value={String(ex.unchanged)} />
                  <Stat
                    label="A / D"
                    value={ad == null ? "—" : Number.isFinite(ad) ? ad.toFixed(2) : "∞"}
                  />
                </div>
                {data?.week52High != null || data?.week52Low != null ? (
                  <p className="text-muted-foreground mt-3 font-mono text-[11px]">
                    52-week high {data.week52High ?? "—"} · 52-week low {data.week52Low ?? "—"}
                  </p>
                ) : null}
                {ex.changePct != null ? (
                  <p className={cn("mt-1 font-mono text-[11px]", pnlClass(ex.changePct))}>
                    Index {formatPct(ex.changePct)}
                  </p>
                ) : null}
              </>
            )}
          </div>
          <div className="overflow-x-auto">
            <SliceTable rows={data?.indices ?? []} nameLabel="Index" />
            {!loading && data && data.indices.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Index rows need the NSE feed. Exchange count above is the fallback tape.
              </p>
            ) : null}
          </div>
        </div>

        {thrust ? (
          <div>
            <p className="text-muted-foreground mb-2 text-[10px] tracking-[0.18em] uppercase">
              Thrust · {thrust.universe.toLocaleString("en-IN")} NSE names
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Up 4.5%+ today" value={String(thrust.up45)} className="text-gain" />
              <Stat label="Down 4.5%+ today" value={String(thrust.down45)} className="text-loss" />
              <Stat label="Up 20%+ in 5d" value={String(thrust.up5d20)} className="text-gain" />
              <Stat label="Down 20%+ in 5d" value={String(thrust.down5d20)} className="text-loss" />
            </div>
          </div>
        ) : null}

        {mas.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {mas.map((tape) => (
              <div key={tape.label}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <p className="text-muted-foreground text-[10px] tracking-[0.16em] uppercase">
                    Above {tape.label}
                  </p>
                  <p
                    className={cn(
                      "font-mono text-sm tabular-nums",
                      breadthTone(tape.aboveShare) === "gain"
                        ? "text-gain"
                        : breadthTone(tape.aboveShare) === "loss"
                          ? "text-loss"
                          : "text-foreground",
                    )}
                  >
                    {tape.aboveShare != null ? `${(tape.aboveShare * 100).toFixed(1)}%` : "—"}
                    <span className="text-muted-foreground">
                      {" "}
                      {tape.above}/{tape.below}
                    </span>
                  </p>
                </div>
                <MaBar tape={tape} />
              </div>
            ))}
          </div>
        ) : null}

        {(data?.sectors?.length ?? 0) > 0 ? (
          <div className="overflow-x-auto">
            <p className="text-muted-foreground mb-2 text-[10px] tracking-[0.18em] uppercase">
              Sector breadth
            </p>
            <SliceTable rows={data?.sectors ?? []} nameLabel="Sector" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
