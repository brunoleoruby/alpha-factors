"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IndexBehaviorPopup, type BehaviorPayload } from "@/components/desk/index-behavior-popup";
import { formatPct, formatSigned, pnlClass } from "@/lib/format";
import { ENV_COLUMNS, type EnvInstrument, type EnvQuote } from "@/lib/markets/environment";
import { cn } from "cn";

type Feed = {
  asOf: string;
  live: number;
  total: number;
  quotes: EnvQuote[];
};

function formatLevel(n: number, digits: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function Row({
  instrument,
  quote,
  loading,
  onOpen,
}: {
  instrument: EnvInstrument;
  quote?: EnvQuote;
  loading: boolean;
  onOpen: () => void;
}) {
  const last = quote?.last;
  const pct = quote?.changePct;
  const chg = quote?.change;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="border-border/50 hover:bg-white/8 flex w-full items-baseline justify-between gap-2 border-b py-2 text-left last:border-b-0"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium underline decoration-white/25 underline-offset-4">
          {instrument.name}
        </p>
        <p className="text-muted-foreground font-mono text-[10px] tracking-wide">{instrument.short}</p>
      </div>
      <div className="text-right">
        {loading && last == null ? (
          <p className="text-muted-foreground text-sm">…</p>
        ) : last == null ? (
          <p className="text-muted-foreground text-xs">{quote?.error ?? "—"}</p>
        ) : (
          <>
            <p className="font-mono text-sm font-semibold">{formatLevel(last, instrument.digits)}</p>
            <p className={cn("font-mono text-[11px]", pct != null ? pnlClass(pct) : "text-muted-foreground")}>
              {pct != null ? formatPct(pct) : "—"}
              {chg != null ? <span className="text-muted-foreground"> {formatSigned(chg)}</span> : null}
            </p>
          </>
        )}
      </div>
    </button>
  );
}

export function MarketEnvironment() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<EnvInstrument | null>(null);
  const [payload, setPayload] = useState<BehaviorPayload | null>(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [popupError, setPopupError] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const res = await fetch("/api/environment", { cache: "no-store" });
        const body = (await res.json()) as Feed & { error?: string };
        if (!res.ok) throw new Error(body.error ?? `Feed ${res.status}`);
        if (dead) return;
        setFeed(body);
        setError(null);
      } catch (err) {
        if (!dead) setError(err instanceof Error ? err.message : "Quote feed down");
      } finally {
        if (!dead) setLoading(false);
      }
    };
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setPayload(null);
      setPopupError(null);
      return;
    }
    let dead = false;
    setPopupLoading(true);
    setPopupError(null);
    setPayload(null);
    void fetch(`/api/environment/behavior?id=${encodeURIComponent(open.id)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as BehaviorPayload & { error?: string };
        if (!res.ok) throw new Error(body.error ?? `Behavior ${res.status}`);
        if (!dead) setPayload(body);
      })
      .catch((err) => {
        if (!dead) setPopupError(err instanceof Error ? err.message : "Behavior feed down");
      })
      .finally(() => {
        if (!dead) setPopupLoading(false);
      });
    return () => {
      dead = true;
    };
  }, [open]);

  const byId = useMemo(() => {
    const m = new Map<string, EnvQuote>();
    for (const q of feed?.quotes ?? []) m.set(q.id, q);
    return m;
  }, [feed]);

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-5 px-4 pb-10 md:px-6">
      <header className="mt-2">
        <p className="text-primary text-xs font-medium tracking-[0.22em] uppercase">Varun G V · personal</p>
        <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Market environment</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
          Six columns, nothing mixed: Indian indices, USA indices, Asia indices, commodity, currency, and
          crude oil. Click a ticker for the tape-rhyme popup — same method as the news desk. Delayed Yahoo
          prints.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {loading ? <Badge variant="outline">Loading tape</Badge> : null}
          {feed ? (
            <Badge variant="outline">
              {feed.live}/{feed.total} live
            </Badge>
          ) : null}
          {error ? <Badge variant="destructive">{error}</Badge> : null}
        </div>
      </header>

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="grid min-w-[72rem] grid-cols-6 gap-3">
          {ENV_COLUMNS.map((col) => (
            <Card key={col.id} className="border-primary/15 bg-card/90 min-w-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-base leading-tight">{col.title}</CardTitle>
                <CardDescription className="text-xs">{col.blurb}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {col.rows.map((row) => (
                  <Row
                    key={row.id}
                    instrument={row}
                    quote={byId.get(row.id)}
                    loading={loading}
                    onOpen={() => setOpen(row)}
                  />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {open ? (
        <IndexBehaviorPopup
          instrument={open}
          quote={byId.get(open.id)}
          payload={payload}
          loading={popupLoading}
          error={popupError}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}
