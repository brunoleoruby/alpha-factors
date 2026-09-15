"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { flushSync } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IndexBehaviorPopup, type BehaviorPayload } from "@/components/desk/index-behavior-popup";
import { PreviousCloseCard, TodayInsightCard } from "@/components/desk/environment-share-card";
import { NseBreadthPanel } from "@/components/desk/nse-breadth-panel";
import { formatPct, formatSigned, pnlClass } from "@/lib/format";
import { ENV_COLUMNS, type EnvInstrument, type EnvQuote } from "@/lib/markets/environment";
import type { NseBreadth } from "@/lib/markets/nse-breadth";
import {
  ENV_SHARE_NOTE_KEY,
  PRE_MARKET_WINDOW,
  buildEnvSharePayload,
  downloadEnvSharePng,
  emptyInsight,
  envShareText,
  envShareTextPrevious,
  envShareTextToday,
  parseStoredInsight,
  preMarketClock,
  type EnvShareInsight,
} from "@/lib/markets/share-environment";
import type { EnvShareChance } from "@/lib/markets/share-ids";
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
      className="border-border/50 hover:bg-foreground/5 flex w-full items-baseline justify-between gap-2 border-b py-2 text-left last:border-b-0"
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
  const [showShare, setShowShare] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [insight, setInsight] = useState<EnvShareInsight>(emptyInsight);
  const [tapeRows, setTapeRows] = useState<EnvShareChance[]>([]);
  const [tapeAsOf, setTapeAsOf] = useState<string>(new Date().toISOString());
  const [tapeLoading, setTapeLoading] = useState(true);
  const [breadth, setBreadth] = useState<NseBreadth | null>(null);
  const [breadthError, setBreadthError] = useState<string | null>(null);
  const [breadthLoading, setBreadthLoading] = useState(true);
  const [preMarket, setPreMarket] = useState(() => preMarketClock());
  const prevCardRef = useRef<HTMLDivElement>(null);
  const todayCardRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    try {
      setInsight(parseStoredInsight(window.localStorage.getItem(ENV_SHARE_NOTE_KEY)));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const tick = () => setPreMarket(preMarketClock());
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let dead = false;
    const loadTape = async () => {
      try {
        const res = await fetch("/api/environment/share-tape", { cache: "no-store" });
        const body = (await res.json()) as { asOf?: string; rows?: EnvShareChance[]; error?: string };
        if (!res.ok) throw new Error(body.error ?? `Tape ${res.status}`);
        if (dead) return;
        setTapeRows(body.rows ?? []);
        if (body.asOf) setTapeAsOf(body.asOf);
      } catch {
        if (!dead) setShareNote("Behaviour tape unread. Quotes may still show from the columns above.");
      } finally {
        if (!dead) setTapeLoading(false);
      }
    };
    void loadTape();
    const t = setInterval(() => void loadTape(), 120_000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let dead = false;
    const loadBreadth = async () => {
      try {
        const res = await fetch("/api/environment/breadth", { cache: "no-store" });
        const body = (await res.json()) as NseBreadth & { error?: string };
        if (!res.ok && !body.exchange) throw new Error(body.error ?? `Breadth ${res.status}`);
        if (dead) return;
        setBreadth(body);
        setBreadthError(body.error ?? null);
      } catch (err) {
        if (!dead) setBreadthError(err instanceof Error ? err.message : "NSE breadth down");
      } finally {
        if (!dead) setBreadthLoading(false);
      }
    };
    void loadBreadth();
    const t = setInterval(() => void loadBreadth(), 60_000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, EnvQuote>();
    for (const q of feed?.quotes ?? []) m.set(q.id, q);
    return m;
  }, [feed]);

  const sharePayload = useMemo(
    () => buildEnvSharePayload(tapeRows, tapeAsOf, insight),
    [tapeRows, tapeAsOf, insight],
  );

  async function copyEnvShare(kind: "both" | "previous" | "today" = "both") {
    const text =
      kind === "previous"
        ? envShareTextPrevious(sharePayload)
        : kind === "today"
          ? envShareTextToday(sharePayload)
          : envShareText(sharePayload);
    try {
      await navigator.clipboard.writeText(text);
      setShareNote(
        kind === "previous"
          ? "Copied previous session close."
          : kind === "today"
            ? "Copied today’s insight."
            : "Copied both cards.",
      );
    } catch {
      setShareNote("Could not copy. Show the cards and copy the text yourself.");
    }
  }

  async function shareEnv() {
    const text = envShareText(sharePayload);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Eminent Corpus · Pre-market", text });
        setShareNote("Shared.");
        return;
      } catch {
        /* cancelled */
      }
    }
    await copyEnvShare("both");
  }

  async function downloadCard(kind: "previous" | "today" | "both") {
    if (!showShare) flushSync(() => setShowShare(true));
    const prev = prevCardRef.current;
    const today = todayCardRef.current;
    try {
      if (kind === "previous" || kind === "both") {
        if (!prev) throw new Error("missing previous card");
        await downloadEnvSharePng(prev, "eminent-corpus-premarket-close.png");
      }
      if (kind === "both") {
        await new Promise((r) => window.setTimeout(r, 400));
      }
      if (kind === "today" || kind === "both") {
        if (!today) throw new Error("missing today card");
        await downloadEnvSharePng(today, "eminent-corpus-premarket-insight.png");
      }
      setShareNote(
        kind === "both"
          ? "Saved both pre-market images."
          : kind === "previous"
            ? "Saved eminent-corpus-premarket-close.png."
            : "Saved eminent-corpus-premarket-insight.png.",
      );
    } catch {
      setShareNote("Could not save. Show both cards, then download again.");
    }
  }

  function onInsight<K extends keyof EnvShareInsight>(key: K, value: string) {
    const next = { ...insight, [key]: value };
    setInsight(next);
    try {
      window.localStorage.setItem(ENV_SHARE_NOTE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-5 px-4 pb-10 md:px-6">
      <header className="mt-2">
        <p className="text-primary text-xs font-medium tracking-[0.22em] uppercase">Varun G V · personal</p>
        <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Market environment</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
          Six columns, nothing mixed: Indian indices, USA indices, Asia indices, commodity, currency, and
          crude oil. NSE exchange breadth sits under the tape. Click a ticker for the tape-rhyme popup —
          same method as the news desk. Delayed prints.
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

      <NseBreadthPanel data={breadth} loading={breadthLoading} error={breadthError} />

      <section className="mt-2 max-w-[940px]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
            Pre-market insights
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="xs" onClick={() => void copyEnvShare("previous")}>
              Copy close
            </Button>
            <Button type="button" variant="outline" size="xs" onClick={() => void copyEnvShare("today")}>
              Copy insight
            </Button>
            <Button type="button" variant="outline" size="xs" onClick={() => void downloadCard("previous")}>
              Download close
            </Button>
            <Button type="button" variant="outline" size="xs" onClick={() => void downloadCard("today")}>
              Download insight
            </Button>
            <Button type="button" variant="outline" size="xs" onClick={() => void downloadCard("both")}>
              Download both
            </Button>
            <Button type="button" size="xs" onClick={() => void shareEnv()}>
              Share both
            </Button>
            <Button type="button" variant="outline" size="xs" onClick={() => setShowShare((open) => !open)}>
              {showShare ? "Hide" : "Show"}
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground mb-3 text-xs">
          Morning companion before the NSE bell ({PRE_MARKET_WINDOW}). Overnight tape only: Nifty, GIFT,
          India VIX, S&amp;P, Nasdaq 100, USDINR, gold, WTI. Two cards — previous session close, then
          today’s insight.{" "}
          <span className={preMarket.inWindow ? "text-foreground" : ""}>{preMarket.label}</span>
          {tapeLoading ? " Reading overnight tape…" : ""}
        </p>
        <p className="text-muted-foreground mb-2 text-[10px] tracking-[0.18em] uppercase">
          Today’s insight (what you mention)
        </p>
        <div className="mb-3 grid gap-3">
          <label className="block">
            <span className="text-muted-foreground mb-1 block text-[11px]">Mindset</span>
            <textarea
              value={insight.mindset}
              onChange={(e) => onInsight("mindset", e.target.value)}
              rows={3}
              maxLength={800}
              placeholder="Today’s mindset — how you are reading this session off the previous close."
              className="border-input bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm leading-relaxed"
            />
          </label>
          <label className="block">
            <span className="text-muted-foreground mb-1 block text-[11px]">Experience</span>
            <textarea
              value={insight.experience}
              onChange={(e) => onInsight("experience", e.target.value)}
              rows={3}
              maxLength={800}
              placeholder="Today’s experience — what this tape rhymes with for you."
              className="border-input bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm leading-relaxed"
            />
          </label>
          <label className="block">
            <span className="text-muted-foreground mb-1 block text-[11px]">Boundary conditions</span>
            <textarea
              value={insight.boundaries}
              onChange={(e) => onInsight("boundaries", e.target.value)}
              rows={3}
              maxLength={800}
              placeholder="Today’s boundaries — what would invalidate this read."
              className="border-input bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm leading-relaxed"
            />
          </label>
        </div>
        {showShare ? (
          <div className="grid gap-8">
            <PreviousCloseCard payload={sharePayload} cardRef={prevCardRef} />
            <TodayInsightCard payload={sharePayload} cardRef={todayCardRef} />
          </div>
        ) : null}
        {shareNote ? <p className="text-muted-foreground mt-3 text-xs">{shareNote}</p> : null}
      </section>

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
