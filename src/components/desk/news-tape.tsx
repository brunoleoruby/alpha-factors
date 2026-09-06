"use client";

import { Badge } from "@/components/ui/badge";
import { formatPct, pnlClass } from "@/lib/format";
import type { AnalyzedItem } from "@/lib/news/engine";

export function NewsTape({
  items,
  selectedId,
  onSelect,
}: {
  items: AnalyzedItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!items.length) {
    return (
      <p className="text-muted-foreground flex h-40 items-center justify-center text-sm">
        No headlines on this session. Advance the tape.
      </p>
    );
  }

  return (
    <ul className="divide-border/70 divide-y">
      {items.map((item) => {
        const active = item.id === selectedId;
        const f = item.forecast;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={`w-full border-l-2 px-2 py-3 text-left transition-colors ${
                active
                  ? "border-primary bg-accent/50"
                  : "border-transparent hover:bg-muted/40"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{item.symbol}</span>
                <Badge variant="outline">{f.eventLabel}</Badge>
                {f.cascade ? <Badge>cascade</Badge> : null}
                {f.echo ? <Badge variant="secondary">echo</Badge> : null}
                {f.neuralAgree ? <Badge variant="outline">NN</Badge> : null}
                <Badge variant={f.side === "skip" ? "secondary" : "default"}>{f.side}</Badge>
              </div>
              <p className="mt-1 text-sm leading-snug">{item.headline}</p>
              <p className="text-muted-foreground mt-1 font-mono text-xs">
                {item.source} · conf {(f.confidence * 100).toFixed(0)}% · 1d{" "}
                <span className={pnlClass(f.expected1d)}>{formatPct(f.expected1d)}</span>
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
