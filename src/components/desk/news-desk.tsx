"use client";

import { useEffect, useMemo, useRef } from "react";
import { EquityChart } from "@/components/desk/equity-chart";
import { NewsControls } from "@/components/desk/news-controls";
import { NewsTape } from "@/components/desk/news-tape";
import { PatternInspector } from "@/components/desk/pattern-inspector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNewsDesk } from "@/hooks/use-news-desk";
import { formatPct, formatUsd, formatUsdFine, pnlClass } from "@/lib/format";
import type { StrategyConfig } from "@/lib/news/taxonomy";

export function NewsDesk() {
  const desk = useNewsDesk();
  const debounce = useRef<number | null>(null);

  useEffect(() => () => {
    if (debounce.current) window.clearTimeout(debounce.current);
  }, []);

  function onConfigChange(next: StrategyConfig) {
    desk.setConfig(next);
    if (desk.running) return;
    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => desk.applyConfig(next), 280);
  }

  const { state } = desk;
  const last = state.equity[state.equity.length - 1];
  const start = state.equity[0]?.equity ?? desk.config.capital;
  const ret = start ? (last?.equity ?? start) / start - 1 : 0;
  const selected = useMemo(() => {
    if (desk.scratch) return desk.scratch;
    const fromTape = state.tape.find((t) => t.id === state.selectedId);
    if (fromTape) return { item: fromTape, forecast: fromTape.forecast };
    const fromHist = state.analyzed.find((t) => t.id === state.selectedId);
    if (fromHist) return { item: fromHist, forecast: fromHist.forecast };
    const fallback = state.tape[0] ?? state.analyzed.at(-1);
    return fallback ? { item: fallback, forecast: fallback.forecast } : null;
  }, [desk.scratch, state.analyzed, state.selectedId, state.tape]);

  const dd = last?.drawdown ?? 0;
  const traded = state.trades.filter((t) => t.confidence > 0).length;

  return (
    <div className="flex min-h-full flex-1 flex-col">
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 px-4 py-5 md:px-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Local workstation
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            News Pattern Desk
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            Runs on your PC in its own window. Classify each headline, rhyme it against similar past
            prints, and paper-trade only when the recognized behavior is strong enough.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={desk.running ? "default" : "secondary"}>
            {desk.running ? "Tape live" : "Idle"}
          </Badge>
          <Badge variant="outline">{state.dates[state.asOfIndex]}</Badge>
          <Badge variant="outline">{state.tape.length} headlines today</Badge>
          {desk.running ? (
            <Button type="button" variant="destructive" onClick={() => desk.setRunning(false)}>
              Stop tape
            </Button>
          ) : (
            <Button type="button" onClick={() => desk.setRunning(true)}>
              Advance tape live
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Paper NAV" value={formatUsd(last?.equity ?? 0)} />
        <Kpi label="News-book return" value={formatPct(ret)} tone={ret} />
        <Kpi label="Max drawdown" value={formatPct(dd)} tone={dd} />
        <Kpi label="Pattern tickets" value={String(traded)} />
      </div>

      <Card className="border-border/80 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Read a headline</CardTitle>
          <CardDescription>
            Paste any stock story. The same classifier and neighbor search used on the tape will
            name the pattern and show how similar news behaved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[140px_1fr_auto] md:items-end">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Select
                value={desk.pasteSymbol}
                onValueChange={(v) => {
                  if (v) desk.setPasteSymbol(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {desk.names.map((n) => (
                    <SelectItem key={n.symbol} value={n.symbol}>
                      {n.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Headline</Label>
              <textarea
                value={desk.paste}
                onChange={(e) => desk.setPaste(e.target.value)}
                rows={2}
                className="border-input bg-input/30 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Company cuts guidance…"
              />
            </div>
            <Button type="button" onClick={desk.runPaste} className="md:mb-0.5">
              Recognize
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <NewsControls
          config={desk.config}
          running={desk.running}
          onChange={onConfigChange}
          onRebuild={desk.rebuild}
          onLive={() => desk.setRunning(true)}
          onStop={() => desk.setRunning(false)}
        />
        <Card className="border-border/80 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Paper book from recognized news</CardTitle>
            <CardDescription>
              {formatUsd(desk.config.capital)} start. Cash {formatUsd(last?.cash ?? 0)}. Open{" "}
              {state.positions.length} names.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EquityChart points={state.equity} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today&apos;s tape</CardTitle>
            <CardDescription>Click a print to inspect its nearest rhymes.</CardDescription>
          </CardHeader>
          <CardContent>
            <NewsTape items={state.tape} selectedId={state.selectedId} onSelect={desk.select} />
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {desk.scratch ? "Pasted headline" : "Pattern match"}
            </CardTitle>
            <CardDescription>
              Neighbor search over prior sessions only — no peeking at the same-day print.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selected ? (
              <PatternInspector item={selected.item} forecast={selected.forecast} />
            ) : (
              <p className="text-muted-foreground text-sm">Select a headline on the tape.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/80">
        <Tabs defaultValue="events">
          <CardHeader className="pb-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Learned behavior by event</CardTitle>
                <CardDescription>
                  Average realized path after each classified event in this history.
                </CardDescription>
              </div>
              <TabsList>
                <TabsTrigger value="events">Event fingerprints</TabsTrigger>
                <TabsTrigger value="trades">Tickets</TabsTrigger>
                <TabsTrigger value="pos">Open</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <TabsContent value="events">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead className="text-right">Prints</TableHead>
                      <TableHead className="text-right">Avg 1d</TableHead>
                      <TableHead className="text-right">Avg 5d</TableHead>
                      <TableHead className="text-right">Fade rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...state.fingerprints]
                      .sort((a, b) => Math.abs(b.avg1d) - Math.abs(a.avg1d))
                      .map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.label}</TableCell>
                          <TableCell className="text-right font-mono">{row.n}</TableCell>
                          <TableCell className={`text-right font-mono ${pnlClass(row.avg1d)}`}>
                            {formatPct(row.avg1d)}
                          </TableCell>
                          <TableCell className={`text-right font-mono ${pnlClass(row.avg5d)}`}>
                            {formatPct(row.avg5d)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {(row.reversal * 100).toFixed(0)}%
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="trades">
              <Trades trades={state.trades} />
            </TabsContent>
            <TabsContent value="pos">
              <Positions positions={state.positions} />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <Separator />
      <p className="text-muted-foreground pb-2 text-xs leading-relaxed">
        Headlines and subsequent returns are simulated so the matcher has a labeled history without
        a news-vendor key. The algorithm is the point: event classification, TF-IDF rhyme, cascade
        and echo flags, then a paper ticket. Not a broker, not live newswire.
      </p>
    </div>
    <footer className="border-border/80 text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-1.5 font-mono text-[11px] md:px-6">
      <span>News Pattern Desk</span>
      <span>session {state.dates[state.asOfIndex]}</span>
      <span>{state.tape.length} prints</span>
      <span>local engine · this PC</span>
      <span className="ml-auto">{desk.running ? "TAPE LIVE" : "IDLE"}</span>
    </footer>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <Card className="border-border/80 bg-card/80">
      <CardContent className="px-4 py-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
        <p className={`mt-1 font-mono text-lg font-semibold ${tone !== undefined ? pnlClass(tone) : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function Trades({
  trades,
}: {
  trades: {
    date: string;
    symbol: string;
    side: string;
    shares: number;
    price: number;
    reason: string;
  }[];
}) {
  const rows = [...trades].reverse().slice(0, 60);
  if (!rows.length) {
    return <p className="text-muted-foreground text-sm">No tickets yet — loosen confidence or wait for a loud print.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Side</TableHead>
            <TableHead className="text-right">Shares</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead>Why</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t, i) => (
            <TableRow key={`${t.date}-${t.symbol}-${i}`}>
              <TableCell className="font-mono text-xs">{t.date}</TableCell>
              <TableCell className="font-medium">{t.symbol}</TableCell>
              <TableCell className={t.side === "buy" ? "text-emerald-400" : "text-rose-400"}>
                {t.side}
              </TableCell>
              <TableCell className="text-right font-mono">{t.shares.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono">{formatUsdFine(t.price)}</TableCell>
              <TableCell className="max-w-sm text-xs">{t.reason}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Positions({
  positions,
}: {
  positions: { symbol: string; shares: number; avgPrice: number; headline: string; exitOn: string; openedOn: string }[];
}) {
  if (!positions.length) {
    return <p className="text-muted-foreground text-sm">Flat. Waiting for the next high-confidence pattern.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Shares</TableHead>
            <TableHead className="text-right">Avg</TableHead>
            <TableHead>Until</TableHead>
            <TableHead>Print</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((p) => (
            <TableRow key={p.symbol + p.openedOn}>
              <TableCell className="font-medium">{p.symbol}</TableCell>
              <TableCell className="text-right font-mono">{p.shares.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono">{formatUsdFine(p.avgPrice)}</TableCell>
              <TableCell className="font-mono text-xs">{p.exitOn}</TableCell>
              <TableCell className="max-w-sm text-xs">{p.headline}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
