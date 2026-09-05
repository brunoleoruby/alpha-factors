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
import type { StrategyConfig } from "@/lib/news/taxonomy";

export function NewsControls({
  config,
  running,
  onChange,
  onRebuild,
  onLive,
  onStop,
}: {
  config: StrategyConfig;
  running: boolean;
  onChange: (next: StrategyConfig) => void;
  onRebuild: () => void;
  onLive: () => void;
  onStop: () => void;
}) {
  return (
    <Card className="border-border/80 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">How the algorithm trades a pattern</CardTitle>
        <CardDescription>
          A print becomes a ticket only if confidence and expected 1-day move clear these bars.
          Cascades (same event, same name, within two days) add conviction. Echoes of a story
          already in the tape are faded.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Min confidence</Label>
            <span className="font-mono">{(config.minConfidence * 100).toFixed(0)}%</span>
          </div>
          <Slider
            min={20}
            max={80}
            step={1}
            value={[Math.round(config.minConfidence * 100)]}
            onValueChange={(v) => {
              const n = Array.isArray(v) ? v[0] : v;
              onChange({ ...config, minConfidence: (typeof n === "number" ? n : 42) / 100 });
            }}
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Min |expected 1d|</Label>
            <span className="font-mono">{(config.minAbsMove * 100).toFixed(1)}%</span>
          </div>
          <Slider
            min={2}
            max={20}
            step={1}
            value={[Math.round(config.minAbsMove * 1000)]}
            onValueChange={(v) => {
              const n = Array.isArray(v) ? v[0] : v;
              onChange({ ...config, minAbsMove: (typeof n === "number" ? n : 6) / 1000 });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Hold after the print</Label>
          <Select
            value={String(config.holdSessions)}
            onValueChange={(v) => onChange({ ...config, holdSessions: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 session</SelectItem>
              <SelectItem value="3">3 sessions</SelectItem>
              <SelectItem value="5">5 sessions</SelectItem>
              <SelectItem value="10">10 sessions</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
          <div>
            <p className="text-sm font-medium">Boost cascades</p>
            <p className="text-muted-foreground text-xs">Clustered headlines on one name</p>
          </div>
          <Switch
            checked={config.cascadeBoost}
            onCheckedChange={(on) => onChange({ ...config, cascadeBoost: on })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
          <div>
            <p className="text-sm font-medium">Skip story echoes</p>
            <p className="text-muted-foreground text-xs">Near-duplicate headlines already priced</p>
          </div>
          <Switch
            checked={config.skipEcho}
            onCheckedChange={(on) => onChange({ ...config, skipEcho: on })}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="flex-1" onClick={onRebuild} disabled={running}>
            New news history
          </Button>
          {running ? (
            <Button type="button" className="flex-1" variant="destructive" onClick={onStop}>
              Stop tape
            </Button>
          ) : (
            <Button type="button" className="flex-1" variant="secondary" onClick={onLive}>
              Advance tape live
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
