"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPct, pnlClass } from "@/lib/format";
import type { BehaviorForecast } from "@/lib/news/patterns";
import type { NewsItem } from "@/lib/news/corpus";

export function PatternInspector({
  item,
  forecast,
}: {
  item: NewsItem;
  forecast: BehaviorForecast;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground text-xs tracking-wide uppercase">Recognized pattern</p>
        <h3 className="mt-1 text-lg font-semibold">{forecast.eventLabel}</h3>
        <p className="mt-1 text-sm leading-relaxed">{item.headline}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline">{item.symbol}</Badge>
          <Badge variant="outline">sentiment {forecast.sentiment.toFixed(2)}</Badge>
          <Badge variant="outline">intensity {(forecast.intensity * 100).toFixed(0)}%</Badge>
          {forecast.cascade ? <Badge>news cascade ×{forecast.cascadeCount + 1}</Badge> : null}
          {forecast.echo ? <Badge variant="secondary">repeat of a recent print</Badge> : null}
          {forecast.neuralAgree ? (
            <Badge>NN agrees</Badge>
          ) : (
            <Badge variant="secondary">NN diverges</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Expected 1d" value={formatPct(forecast.expected1d)} tone={forecast.expected1d} />
        <Stat label="Expected 5d" value={formatPct(forecast.expected5d)} tone={forecast.expected5d} />
        <Stat label="Neighbor 1d" value={formatPct(forecast.linear1d)} tone={forecast.linear1d} />
        <Stat label="Neural 1d" value={formatPct(forecast.neural1d)} tone={forecast.neural1d} />
        <Stat label="Hit rate" value={`${(forecast.hitRate * 100).toFixed(0)}%`} />
        <Stat label="Fade / reverse" value={`${(forecast.reversalRate * 100).toFixed(0)}%`} />
      </div>
      <p className="text-muted-foreground text-xs">
        Neighbors are TF-IDF cosine rhymes (linear blend of past 1d paths). A small MLP, trained on
        earlier labeled prints, maps non-linear sentiment and alternative-data flags (source, SEBI/RBI/FII
        language, intensity) into its own 1d/5d move. The desk averages the two
        {forecast.neuralAgree ? " — they agree on direction." : " — they disagree, so confidence is cut."}{" "}
        Confidence {(forecast.confidence * 100).toFixed(0)}% →{" "}
        <span className="text-foreground font-medium">{forecast.side}</span>.
      </p>

      <div>
        <p className="mb-2 text-sm font-medium">Nearest historical rhymes</p>
        {forecast.matches.length === 0 ? (
          <p className="text-muted-foreground text-sm">Not enough history to rhyme this print yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Headline</TableHead>
                  <TableHead className="text-right">Sim</TableHead>
                  <TableHead className="text-right">1d</TableHead>
                  <TableHead className="text-right">5d</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecast.matches.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{m.date}</TableCell>
                    <TableCell className="font-medium">{m.symbol}</TableCell>
                    <TableCell className="max-w-xs text-xs leading-snug">{m.headline}</TableCell>
                    <TableCell className="text-right font-mono">{(m.similarity * 100).toFixed(0)}%</TableCell>
                    <TableCell className={`text-right font-mono ${pnlClass(m.ret1d)}`}>
                      {formatPct(m.ret1d)}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${pnlClass(m.ret5d)}`}>
                      {formatPct(m.ret5d)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="rounded-lg border border-border/70 px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`font-mono text-sm font-medium ${tone !== undefined ? pnlClass(tone) : ""}`}>
        {value}
      </p>
    </div>
  );
}
