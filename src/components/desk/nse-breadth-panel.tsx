"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { type BreadthDay, type NseBreadth } from "@/lib/markets/nse-breadth";
import { cn } from "cn";

const COUNT = new Intl.NumberFormat("en-IN");

function toneClass(tone?: "gain" | "loss") {
  if (tone === "gain") return "[color:oklch(0.62_0.2_145)]";
  if (tone === "loss") return "[color:oklch(0.62_0.22_25)]";
  return "text-muted-foreground";
}

function toneFill(tone?: "gain" | "loss") {
  if (tone === "gain") return "bg-[oklch(0.62_0.2_145/0.12)]";
  if (tone === "loss") return "bg-[oklch(0.62_0.22_25/0.12)]";
  return "";
}

function BreadthChart({
  title,
  rows,
  aboveKey,
  belowKey,
  aboveLabel,
  belowLabel,
}: {
  title: string;
  rows: BreadthDay[];
  aboveKey: keyof BreadthDay;
  belowKey: keyof BreadthDay;
  aboveLabel: string;
  belowLabel: string;
}) {
  const series = [...rows].reverse();
  const w = 420;
  const h = 180;
  const pad = { l: 36, r: 8, t: 12, b: 22 };
  const vals = series.flatMap((r) => [Number(r[aboveKey]), Number(r[belowKey])]);
  const max = Math.max(1, ...vals);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const x = (i: number) => pad.l + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  function path(key: keyof BreadthDay) {
    return series
      .map((row, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(Number(row[key])).toFixed(1)}`)
      .join(" ");
  }
  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground font-mono text-[10px]">
          <span className={toneClass("gain")}>{aboveLabel}</span>
          {" · "}
          <span className={toneClass("loss")}>{belowLabel}</span>
        </p>
      </div>
      {series.length < 2 ? (
        <p className="text-muted-foreground text-xs">Need two sessions to plot.</p>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="h-[180px] w-full" role="img" aria-label={title}>
          <path d={path(aboveKey)} fill="none" stroke="oklch(0.62 0.2 145)" strokeWidth="1.75" />
          <path d={path(belowKey)} fill="none" stroke="oklch(0.62 0.22 25)" strokeWidth="1.75" />
        </svg>
      )}
    </div>
  );
}

function GroupHead({ label, span, first }: { label: string; span: number; first?: boolean }) {
  return (
    <th
      colSpan={span}
      scope="colgroup"
      className={cn(
        "text-foreground/85 sticky top-0 z-20 border-b bg-card px-3 py-1.5 text-center text-[10px] font-semibold tracking-[0.14em] uppercase",
        !first && "border-l border-border/70",
      )}
    >
      {label}
    </th>
  );
}

function ColHead({
  label,
  tone,
  first,
}: {
  label: string;
  tone?: "gain" | "loss";
  first?: boolean;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "sticky top-[1.85rem] z-10 whitespace-nowrap px-3 py-2 text-right text-[11px] font-semibold",
        !first && "border-l border-border/40",
        toneClass(tone),
        tone ? toneFill(tone) : "bg-card",
      )}
    >
      {label}
    </th>
  );
}

function CountCell({
  n,
  tone,
  groupStart,
}: {
  n: number;
  tone?: "gain" | "loss";
  groupStart?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-3 py-2 text-right font-mono text-sm font-semibold tabular-nums",
        groupStart && "border-l border-border/40",
        toneClass(tone),
        toneFill(tone),
      )}
    >
      {COUNT.format(n)}
    </td>
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
  const history = data?.history ?? [];
  const liveDate = history[0]?.date;

  return (
    <Card className="border-primary/15 bg-card/90">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base leading-tight">Market breadth</CardTitle>
            <CardDescription className="text-xs">NSE names — one row per session.</CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {loading ? <Badge variant="outline">Reading</Badge> : null}
            {history.length ? (
              <Badge variant="outline">
                {history.length} session{history.length === 1 ? "" : "s"} stored
              </Badge>
            ) : null}
            {error ? <Badge variant="destructive">{error}</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 pt-0">
        <div className="border-border/60 max-h-[28rem] overflow-auto rounded-lg border">
          <table className="w-full min-w-[64rem] border-collapse text-sm">
            <caption className="sr-only">
              Market breadth by date: names up or down 4.5% today, up or down 20% in five days, and above or
              below the 20, 50, and 200 day moving averages.
            </caption>
            <colgroup>
              <col className="w-[8.5rem]" />
              <col span={2} />
              <col span={2} />
              <col span={2} />
              <col span={2} />
              <col span={2} />
            </colgroup>
            <thead>
              <tr className="bg-card">
                <th
                  rowSpan={2}
                  scope="col"
                  className="sticky top-0 left-0 z-30 border-b bg-card px-3 py-2 text-left text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
                >
                  Date
                </th>
                <GroupHead label="Today" span={2} first />
                <GroupHead label="5 days" span={2} />
                <GroupHead label="20 DMA" span={2} />
                <GroupHead label="50 DMA" span={2} />
                <GroupHead label="200 DMA" span={2} />
              </tr>
              <tr className="bg-card">
                <ColHead label="Up 4.5%+" tone="gain" first />
                <ColHead label="Down 4.5%+" tone="loss" />
                <ColHead label="Up 20%+" tone="gain" first />
                <ColHead label="Down 20%+" tone="loss" />
                <ColHead label="Above" tone="gain" first />
                <ColHead label="Below" tone="loss" />
                <ColHead label="Above" tone="gain" first />
                <ColHead label="Below" tone="loss" />
                <ColHead label="Above" tone="gain" first />
                <ColHead label="Below" tone="loss" />
              </tr>
            </thead>
            <tbody>
              {loading && !history.length ? (
                <tr>
                  <td className="text-muted-foreground px-3 py-4" colSpan={11}>
                    Reading market breadth…
                  </td>
                </tr>
              ) : !history.length ? (
                <tr>
                  <td className="text-muted-foreground px-3 py-4" colSpan={11}>
                    No breadth rows yet.
                  </td>
                </tr>
              ) : (
                history.slice(0, 40).map((row, i) => {
                  const live = row.date === liveDate;
                  return (
                    <tr
                      key={row.date}
                      className={cn(
                        "border-border/50 border-b last:border-0",
                        i % 2 === 1 && "bg-foreground/[0.03]",
                        live && "bg-primary/8",
                      )}
                    >
                      <th
                        scope="row"
                        className={cn(
                          "sticky left-0 z-20 bg-card px-3 py-2 text-left font-mono text-xs font-medium tabular-nums",
                          live && "bg-primary/8",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {formatDate(row.date)}
                          {live ? (
                            <span className="text-primary text-[9px] font-semibold tracking-[0.12em] uppercase">
                              Live
                            </span>
                          ) : null}
                        </span>
                      </th>
                      <CountCell n={row.up45} tone="gain" />
                      <CountCell n={row.down45} tone="loss" />
                      <CountCell n={row.up5d20} tone="gain" groupStart />
                      <CountCell n={row.down5d20} tone="loss" />
                      <CountCell n={row.above20} tone="gain" groupStart />
                      <CountCell n={row.below20} tone="loss" />
                      <CountCell n={row.above50} tone="gain" groupStart />
                      <CountCell n={row.below50} tone="loss" />
                      <CountCell n={row.above200} tone="gain" groupStart />
                      <CountCell n={row.below200} tone="loss" />
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <BreadthChart
            title="Nifty market breadth"
            rows={history}
            aboveKey="above20"
            belowKey="below20"
            aboveLabel="above 20ema"
            belowLabel="below 20ema"
          />
          <BreadthChart
            title="Nifty market breadth"
            rows={history}
            aboveKey="above50"
            belowKey="below50"
            aboveLabel="above 50ema"
            belowLabel="below 50ema"
          />
          <BreadthChart
            title="Nifty market breadth"
            rows={history}
            aboveKey="above200"
            belowKey="below200"
            aboveLabel="above 200ema"
            belowLabel="below 200ema"
          />
        </div>
      </CardContent>
    </Card>
  );
}
