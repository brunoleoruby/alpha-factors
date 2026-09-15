"use client";

import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPct, formatSigned, pnlClass } from "@/lib/format";
import type { TapeBehavior } from "@/lib/markets/tape-behavior";
import type { EnvInstrument, EnvQuote } from "@/lib/markets/environment";
import { cn } from "cn";

export type BehaviorPayload = {
  id: string;
  name: string;
  short: string;
  yahoo: string;
  column: string;
  last: number | null;
  behavior: TapeBehavior;
};

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 320;
  const h = 72;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="bg-card h-16 w-full" role="img" aria-label="Recent path">
      <path d={d} fill="none" stroke="#c4b49a" strokeWidth="2" />
    </svg>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="border-border/60 rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-[10px] tracking-[0.16em] uppercase">{label}</p>
      <p className={cn("mt-1 font-mono text-sm tabular-nums", tone !== undefined ? pnlClass(tone) : "")}>
        {value}
      </p>
    </div>
  );
}

export function IndexBehaviorPopup({
  instrument,
  quote,
  payload,
  loading,
  error,
  onClose,
}: {
  instrument: EnvInstrument;
  quote?: EnvQuote;
  payload: BehaviorPayload | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const b = payload?.behavior;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[12vh]">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="behavior-title"
        className="border-border bg-card relative z-10 w-full max-w-2xl rounded-xl border shadow-2xl"
      >
        <div className="border-border flex items-start justify-between gap-3 border-b px-5 py-3">
          <div>
            <p className="text-primary text-[10px] tracking-[0.22em] uppercase">Algorithm · tape rhyme</p>
            <h2 id="behavior-title" className="font-heading mt-1 text-2xl font-semibold">
              {instrument.name}
            </h2>
            <p className="text-muted-foreground mt-0.5 font-mono text-xs">
              {instrument.short}
              {quote?.last != null ? ` · ${quote.last.toLocaleString("en-IN")}` : ""}
              {quote?.changePct != null ? ` · ${formatPct(quote.changePct)}` : ""}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
          {loading ? <p className="text-muted-foreground text-sm">Reading path and rhyming analogues…</p> : null}
          {error ? <p className="text-sm text-red-200">{error}</p> : null}
          {b ? (
            <>
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{b.regime}</Badge>
                  <Badge variant="outline">{b.structure}</Badge>
                  <Badge variant="outline">side {b.side}</Badge>
                  <Badge variant="outline">conf {(b.confidence * 100).toFixed(0)}%</Badge>
                  {b.cascade ? <Badge>cascade ×{b.cascadeCount}</Badge> : null}
                  {b.echo ? <Badge variant="secondary">echo print</Badge> : null}
                </div>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{b.regimeNote}</p>
              </div>

              <div className="overflow-hidden rounded-lg">
                <Spark values={b.spark} />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Expected 1d" value={formatPct(b.expected1d)} tone={b.expected1d} />
                <Stat label="Expected 5d" value={formatPct(b.expected5d)} tone={b.expected5d} />
                <Stat label="Neighbor 1d" value={formatPct(b.linear1d)} tone={b.linear1d} />
                <Stat label="Hit rate" value={`${(b.hitRate * 100).toFixed(0)}%`} />
                <Stat label="Fade / reverse" value={`${(b.reversalRate * 100).toFixed(0)}%`} />
                <Stat label="Spot 1d" value={formatPct(b.ret1d)} tone={b.ret1d} />
                <Stat label="Spot 5d" value={formatPct(b.ret5d)} tone={b.ret5d} />
                <Stat label="20d vol" value={formatPct(b.vol20)} />
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Same desk method as news: cosine rhymes on the last 10 daily returns, weighted 1d/5d
                paths, cascade boost if the tape stacks, echo haircut if a recent window already
                rhymed. Confidence {(b.confidence * 100).toFixed(0)}% →{" "}
                <span className="text-foreground font-medium">{b.side}</span>
                {quote?.change != null ? ` · day ${formatSigned(quote.change)}` : ""}.
              </p>

              <div>
                <p className="mb-2 text-sm font-medium">Nearest historical rhymes</p>
                {b.matches.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Not enough history to rhyme this path yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b border-white/15 text-left text-[10px] tracking-[0.16em] uppercase">
                        <th className="py-2 font-medium">When</th>
                        <th className="py-2 text-right font-medium">Sim</th>
                        <th className="py-2 text-right font-medium">Then 1d</th>
                        <th className="py-2 text-right font-medium">Then 5d</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.matches.map((m) => (
                        <tr key={m.id} className="border-b border-white/10 last:border-0">
                          <td className="py-2 font-mono text-xs">{m.date}</td>
                          <td className="py-2 text-right font-mono tabular-nums">
                            {(m.similarity * 100).toFixed(0)}%
                          </td>
                          <td className={`py-2 text-right font-mono tabular-nums ${pnlClass(m.ret1d)}`}>
                            {formatPct(m.ret1d)}
                          </td>
                          <td className={`py-2 text-right font-mono tabular-nums ${pnlClass(m.ret5d)}`}>
                            {formatPct(m.ret5d)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
