"use client";

import { useEffect, useRef } from "react";
import { EquityChart } from "@/components/desk/equity-chart";
import { KpiStrip } from "@/components/desk/kpi-strip";
import { PositionsTable } from "@/components/desk/positions-table";
import { RankingsTable } from "@/components/desk/rankings-table";
import { StrategyPanel } from "@/components/desk/strategy-panel";
import { TradesTable } from "@/components/desk/trades-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFactorDesk } from "@/hooks/use-factor-desk";
import { formatPct, formatUsd } from "@/lib/trading/format";
import type { StrategyConfig } from "@/lib/trading/types";

export function FactorDesk() {
  const desk = useFactorDesk();
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current);
    };
  }, []);

  function onConfigChange(next: StrategyConfig) {
    desk.setConfig(next);
    if (desk.running) return;
    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      desk.applyAndReplay(next);
    }, 280);
  }

  if (!desk.state) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">
          {desk.error ?? "Scoring the universe…"}
        </p>
      </div>
    );
  }

  const { state } = desk;
  const last = state.equity[state.equity.length - 1];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Factor automation
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            Paper desk
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            Rank 24 names on momentum, mean reversion, low volatility, value, quality, and
            liquidity. The book longs the highest composite scores, optionally shorts the lowest,
            and rebalances on a schedule.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={desk.running ? "default" : "secondary"}>
            {desk.running ? `Live paper on · ${desk.ticks} new sessions` : "Idle"}
          </Badge>
          <Badge variant="outline">{state.market.dates[state.asOfIndex]}</Badge>
          <Badge variant="outline">{state.stats.tradeCount} fills</Badge>
          {desk.running ? (
            <Button type="button" variant="destructive" onClick={desk.stop}>
              Stop automation
            </Button>
          ) : (
            <Button type="button" onClick={desk.startAutomation} disabled={desk.busy}>
              Run live paper
            </Button>
          )}
        </div>
      </header>

      {desk.error ? (
        <div className="border-destructive/40 bg-destructive/10 rounded-xl border px-4 py-3 text-sm">
          {desk.error}
        </div>
      ) : null}

      <KpiStrip state={state} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <StrategyPanel
          config={desk.config}
          running={desk.running}
          busy={desk.busy}
          onChange={onConfigChange}
          onRebuild={() => desk.rebuild(desk.config)}
          onAutomate={desk.startAutomation}
          onStop={desk.stop}
        />

        <Card className="border-border/80 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Equity</CardTitle>
            <CardDescription>
              Starting capital {formatUsd(desk.config.capital)}. Cash {formatUsd(last?.cash ?? 0)}.
              Long {formatPct(state.stats.longExposure)} / short {formatPct(state.stats.shortExposure)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EquityChart points={state.equity} />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/80">
        <Tabs defaultValue="ranks">
          <CardHeader className="pb-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Book</CardTitle>
                <CardDescription>Cross-sectional z-scores, holdings, and the fill blotter.</CardDescription>
              </div>
              <TabsList>
                <TabsTrigger value="ranks">Rankings</TabsTrigger>
                <TabsTrigger value="positions">Positions</TabsTrigger>
                <TabsTrigger value="trades">Trades</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <TabsContent value="ranks">
              <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                Cross-section ranked by composite score
              </p>
              <RankingsTable rankings={state.rankings} targets={state.targets} />
            </TabsContent>
            <TabsContent value="positions">
              <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                Open holdings marked to the latest close
              </p>
              <PositionsTable positions={state.positions} />
            </TabsContent>
            <TabsContent value="trades">
              <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                Latest rebalance fills (newest first)
              </p>
              <TradesTable trades={state.trades} />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <Separator />
      <p className="text-muted-foreground pb-8 text-xs leading-relaxed">
        Educational paper trading only. Prices, earnings yield, and ROE are simulated so the
        factors have a measurable signal without a market-data key. Do not use this to place live
        orders.
      </p>
    </div>
  );
}
