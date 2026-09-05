"use client";

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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { FactorId, StrategyConfig } from "@/lib/trading/types";
import { FACTOR_IDS } from "@/lib/trading/types";
import { FACTOR_META } from "@/lib/trading/universe";

type Props = {
  config: StrategyConfig;
  running: boolean;
  busy: boolean;
  onChange: (next: StrategyConfig) => void;
  onRebuild: () => void;
  onAutomate: () => void;
  onStop: () => void;
};

export function StrategyPanel({
  config,
  running,
  busy,
  onChange,
  onRebuild,
  onAutomate,
  onStop,
}: Props) {
  const shortEnabled = config.shortCount > 0;
  const totalWeight = FACTOR_IDS.reduce((a, id) => a + config.weights[id], 0);

  function setWeight(id: FactorId, value: number) {
    onChange({ ...config, weights: { ...config.weights, [id]: value } });
  }

  return (
    <Card className="border-border/80 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Factor mix</CardTitle>
        <CardDescription>
          Weights are normalized into a composite z-score. Names with the highest score are
          bought; the lowest are shorted when the short book is on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-4">
          {FACTOR_IDS.map((id) => (
            <div key={id} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <Label className="text-sm">{FACTOR_META[id].label}</Label>
                  <p className="text-muted-foreground text-xs leading-snug">
                    {FACTOR_META[id].description}
                  </p>
                </div>
                <span className="font-mono text-sm tabular-nums">
                  {config.weights[id]}
                  <span className="text-muted-foreground">
                    /{totalWeight || 1} ({totalWeight ? Math.round((100 * config.weights[id]) / totalWeight) : 0}
                    %)
                  </span>
                </span>
              </div>
              <Slider
                min={0}
                max={50}
                step={1}
                value={[config.weights[id]]}
                onValueChange={(v) => {
                  const n = Array.isArray(v) ? v[0] : v;
                  setWeight(id, typeof n === "number" ? n : 0);
                }}
                aria-label={`${FACTOR_META[id].label} weight`}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Long names</Label>
            <Select
              value={String(config.longCount)}
              onValueChange={(v) => onChange({ ...config, longCount: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[4, 6, 8, 10, 12].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Top {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Rebalance</Label>
            <Select
              value={String(config.rebalanceEvery)}
              onValueChange={(v) => onChange({ ...config, rebalanceEvery: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Every session</SelectItem>
                <SelectItem value="5">Weekly</SelectItem>
                <SelectItem value="21">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2">
          <div>
            <p className="text-sm font-medium">Short the laggards</p>
            <p className="text-muted-foreground text-xs">Market-neutral 50/50 long-short book</p>
          </div>
          <Switch
            checked={shortEnabled}
            onCheckedChange={(on) => onChange({ ...config, shortCount: on ? 4 : 0 })}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="flex-1" onClick={onRebuild} disabled={busy || running}>
            {busy ? "Scoring…" : "Rebuild paper book"}
          </Button>
          {running ? (
            <Button type="button" className="flex-1" variant="destructive" onClick={onStop}>
              Stop automation
            </Button>
          ) : (
            <Button
              type="button"
              className="flex-1"
              variant="secondary"
              onClick={onAutomate}
              disabled={busy}
            >
              Run live paper
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Live paper appends a new simulated session every ~1s and rebalances when the calendar
          says so. This is not a broker, and prices are synthetic.
        </p>
      </CardContent>
    </Card>
  );
}
