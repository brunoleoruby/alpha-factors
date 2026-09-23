"use client";

import { FormEvent, Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ProfitShareCard } from "@/components/desk/profit-share-card";
import { SegmentShareCard } from "@/components/desk/segment-share-card";
import { useHeaderSave } from "@/components/desk/header-save";
import { EquityChart } from "@/components/desk/equity-chart";
import { FeedSource } from "@/components/desk/feed-source";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatNum, formatPct, formatRr, pnlClass, toDayMonthYear, toIsoDate } from "@/lib/format";
import { analyzePositions, hitRateByBuyDate, money, portfolioCurve, profitBySellDate, returnOnCapital, summaryForView, type HitRateBucket, type ProfitBucket } from "@/lib/portfolio/analytics";
import { downloadProfitSharePng, profitShareText } from "@/lib/portfolio/share-profit";
import { downloadSegmentSharePng, segmentShareText } from "@/lib/portfolio/share-segment";
import {
  applyTradePrices,
  buyAvg,
  capitalForView,
  emptyPositionForm,
  holdingDays,
  inferBookSide,
  loadPositionBook,
  parsePositionBook,
  positionId,
  mergeAccountCapitals,
  mergeFilePositions,
  mergeSummaries,
  savePositionBook,
  sellAvg,
  sliceKey,
  riskRewardRatio,
  type AccountCapitals,
  type BookSide,
  type PositionBook,
  type PositionLine,
  type AccountSummaries,
} from "@/lib/portfolio/positions";
import {
  ACCOUNTS,
  SEGMENTS,
  accountLabel,
  segmentLabel,
  type TradeAccount,
  type TradeSegment,
  type TradeSide,
} from "@/lib/portfolio/trades";

const fieldClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground";

type SortKey =
  | "symbol"
  | "from"
  | "to"
  | "buyDate"
  | "sellDate"
  | "hold"
  | "quantity"
  | "buyValue"
  | "sellValue"
  | "buyAvg"
  | "sellAvg"
  | "realized"
  | "realizedPct"
  | "riskAmount"
  | "riskReward"
  | "onCapital"
  | "side"
  | "openQty"
  | "openValue"
  | "unrealized"
  | "account"
  | "segment";

type SortState = { key: SortKey; dir: "asc" | "desc" };

function sortValue(row: PositionLine, key: SortKey): string | number {
  switch (key) {
    case "symbol":
      return row.symbol;
    case "from":
      return row.from;
    case "to":
      return row.to;
    case "buyDate":
      return row.buyDate;
    case "sellDate":
      return row.sellDate;
    case "hold":
      return holdingDays(row) ?? -Infinity;
    case "quantity":
      return row.quantity;
    case "buyValue":
      return row.buyValue;
    case "sellValue":
      return row.sellValue;
    case "buyAvg":
      return buyAvg(row);
    case "sellAvg":
      return sellAvg(row);
    case "realized":
      return row.realizedPnl;
    case "realizedPct":
      return row.realizedPnlPct;
    case "riskAmount":
      return row.riskAmount;
    case "riskReward":
      return riskRewardRatio(row.realizedPnl, row.riskAmount) ?? -Infinity;
    case "onCapital":
      return row.realizedPnl;
    case "side":
      return inferBookSide(row);
    case "openQty":
      return row.openQty;
    case "openValue":
      return row.openValue;
    case "unrealized":
      return row.unrealizedPnl;
    case "account":
      return row.account;
    case "segment":
      return segmentLabel(row.segment);
  }
}

function sortRows(rows: PositionLine[], sort: SortState) {
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = sortValue(a, sort.key);
    const bv = sortValue(b, sort.key);
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    if (!cmp) cmp = a.symbol.localeCompare(b.symbol);
    return sort.dir === "asc" ? cmp : -cmp;
  });
  return copy;
}

function toggleSort(prev: SortState, key: SortKey): SortState {
  if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
  return { key, dir: key === "symbol" || key === "buyDate" || key === "sellDate" || key === "from" || key === "to" || key === "account" || key === "segment" || key === "side" ? "asc" : "desc" };
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="min-w-0 overflow-hidden">
      <p className="text-muted-foreground truncate text-[10px] tracking-[0.14em] uppercase">{label}</p>
      <p
        className={`mt-2 font-mono text-lg tracking-tight break-all tabular-nums md:text-xl ${
          tone !== undefined ? pnlClass(tone) : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function PortfolioBlotter() {
  const [positions, setPositions] = useState<PositionLine[]>([]);
  const [summaries, setSummaries] = useState<AccountSummaries>({});
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState(emptyPositionForm);
  const [error, setError] = useState<string | null>(null);
  const [persist, setPersist] = useState<"disk" | "browser" | "error">("browser");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [autoFetch, setAutoFetch] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRows, setEditRows] = useState(false);
  const [editBuy, setEditBuy] = useState("");
  const [editSell, setEditSell] = useState("");
  const [editBuyPx, setEditBuyPx] = useState("");
  const [editSellPx, setEditSellPx] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editSide, setEditSide] = useState<BookSide>("long");
  const [editRisk, setEditRisk] = useState("");
  const [journalId, setJournalId] = useState<string | null>(null);
  const [journalText, setJournalText] = useState("");
  const [realizedSort, setRealizedSort] = useState<SortState>({ key: "realized", dir: "desc" });
  const [bookSort, setBookSort] = useState<SortState>({ key: "symbol", dir: "asc" });
  const [bookView, setBookView] = useState<"all" | TradeAccount>("all");
  const [segmentView, setSegmentView] = useState<"all" | TradeSegment>("all");
  const [dirty, setDirty] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [totalCapital, setTotalCapital] = useState(0);
  const [accountCapitals, setAccountCapitals] = useState<AccountCapitals>({});
  const [capitalText, setCapitalText] = useState("");
  const [editCapital, setEditCapital] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [showShareTable, setShowShareTable] = useState(false);
  const [showSegmentShare, setShowSegmentShare] = useState(false);
  const [bench, setBench] = useState<{
    nifty50: number | null;
    smallcap: number | null;
  } | null>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const segmentShareRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let dead = false;
    const boot = async () => {
      const local = loadPositionBook();
      try {
        const res = await fetch("/api/portfolio/positions", { cache: "no-store" });
        const body = (await res.json()) as unknown;
        if (!res.ok) throw new Error("Load failed");
        const disk = parsePositionBook(body);
        if (dead) return;
        if (disk.positions.length || disk.summary || Object.keys(disk.summaries).length) {
          const capital = disk.totalCapital || local.totalCapital;
          const capitals = mergeAccountCapitals(disk.accountCapitals, local.accountCapitals);
          setPositions(disk.positions);
          setSummaries(disk.summaries);
          setTotalCapital(capital);
          setAccountCapitals(capitals);
          setCapitalText(capital > 0 ? String(capital) : "");
          savePositionBook({ ...disk, totalCapital: capital, accountCapitals: capitals });
        } else if (local.positions.length) {
          setPositions(local.positions);
          setSummaries(local.summaries);
          setTotalCapital(local.totalCapital);
          setAccountCapitals(local.accountCapitals);
          setCapitalText(local.totalCapital > 0 ? String(local.totalCapital) : "");
          await fetch("/api/portfolio/positions", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(local),
          });
        }
        setPersist("disk");
      } catch {
        if (dead) return;
        setPositions(local.positions);
        setSummaries(local.summaries);
        setTotalCapital(local.totalCapital);
        setAccountCapitals(local.accountCapitals);
        setCapitalText(local.totalCapital > 0 ? String(local.totalCapital) : "");
        setPersist("browser");
      } finally {
        if (!dead) setReady(true);
      }
    };
    void boot();
    return () => {
      dead = true;
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const viewRows = useMemo(() => {
    return positions.filter((row) => {
      if (bookView !== "all" && row.account !== bookView) return false;
      if (segmentView !== "all" && row.segment !== segmentView) return false;
      return true;
    });
  }, [positions, bookView, segmentView]);
  const viewSummary = useMemo(
    () => summaryForView(summaries, bookView, segmentView),
    [summaries, bookView, segmentView],
  );
  const analytics = useMemo(() => analyzePositions(viewRows, viewSummary), [viewRows, viewSummary]);
  const allBook = useMemo(
    () => analyzePositions(positions, summaryForView(summaries, "all", "all")),
    [positions, summaries],
  );
  const accountRows = useMemo(
    () => (bookView === "all" ? positions : positions.filter((row) => row.account === bookView)),
    [positions, bookView],
  );
  const accountBook = useMemo(() => {
    if (bookView === "all") return allBook;
    return analyzePositions(accountRows, summaryForView(summaries, bookView, "all"));
  }, [bookView, accountRows, summaries, allBook]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allSelected = viewRows.length > 0 && viewRows.every((row) => selectedSet.has(row.id));
  const someSelected = viewRows.some((row) => selectedSet.has(row.id)) && !allSelected;
  const ranked = useMemo(() => sortRows(viewRows, realizedSort), [viewRows, realizedSort]);
  const bookRows = useMemo(() => sortRows(viewRows, bookSort), [viewRows, bookSort]);
  const viewCapital = useMemo(
    () => capitalForView(bookView, totalCapital, accountCapitals),
    [bookView, totalCapital, accountCapitals],
  );
  const roc = useMemo(() => returnOnCapital(analytics.netPnl, viewCapital), [analytics.netPnl, viewCapital]);
  const rocBeforeCharges = useMemo(
    () => returnOnCapital(analytics.realized, viewCapital),
    [analytics.realized, viewCapital],
  );
  const curve = useMemo(() => portfolioCurve(viewRows, viewSummary), [viewRows, viewSummary]);
  const benchFrom = viewSummary?.from || viewRows[0]?.from || "";
  const benchTo = viewSummary?.to || viewRows[0]?.to || "";

  useEffect(() => {
    if (!benchFrom || !benchTo) {
      setBench(null);
      return;
    }
    let dead = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/portfolio/benchmarks?from=${encodeURIComponent(benchFrom)}&to=${encodeURIComponent(benchTo)}`,
          { cache: "no-store" },
        );
        const body = (await res.json()) as {
          rows?: { id: string; return: number | null }[];
        };
        if (dead || !res.ok) return;
        const nifty50 = body.rows?.find((row) => row.id === "nifty50")?.return ?? null;
        const smallcap = body.rows?.find((row) => row.id === "smallcap")?.return ?? null;
        setBench({ nifty50, smallcap });
      } catch {
        if (!dead) setBench(null);
      }
    };
    void load();
    return () => {
      dead = true;
    };
  }, [benchFrom, benchTo]);
  const hitRates = useMemo(() => hitRateByBuyDate(viewRows), [viewRows]);
  const sellProfits = useMemo(() => profitBySellDate(viewRows), [viewRows]);
  const sharePayload = useMemo(
    () => ({
      bookLabel:
        bookView === "all"
          ? "All accounts"
          : `${accountLabel(bookView)}${segmentView === "all" ? "" : ` · ${segmentLabel(segmentView)}`}`,
      from: viewSummary?.from,
      to: viewSummary?.to,
      capital: viewCapital,
      realized: analytics.realized,
      rocBeforeCharges,
      charges: analytics.costs,
      otherCD: viewSummary?.otherCreditDebit ?? 0,
      netPnl: analytics.netPnl,
      roc,
      nifty50: bench?.nifty50 ?? null,
      smallcap: bench?.smallcap ?? null,
      curve,
    }),
    [
      bookView,
      segmentView,
      viewSummary,
      viewCapital,
      analytics.realized,
      rocBeforeCharges,
      analytics.costs,
      analytics.netPnl,
      roc,
      bench,
      curve,
    ],
  );
  const segmentSharePayload = useMemo(
    () => ({
      bookLabel:
        bookView === "all"
          ? "All accounts"
          : `${accountLabel(bookView)}${segmentView === "all" ? "" : ` · ${segmentLabel(segmentView)}`}`,
      from: viewSummary?.from,
      to: viewSummary?.to,
      capital: viewCapital,
      rows: analytics.bySegment.map((row) => ({
        id: row.id,
        label: row.label,
        names: row.trades,
        gross: row.gross,
        pnl: row.totalPnl,
        roc: returnOnCapital(row.totalPnl, viewCapital),
      })),
    }),
    [bookView, segmentView, viewSummary, viewCapital, analytics.bySegment],
  );

  async function copyProfitShare() {
    const text = profitShareText(sharePayload);
    try {
      await navigator.clipboard.writeText(text);
      setShareNote("Copied. Paste into WhatsApp, X, or a caption.");
    } catch {
      setShareNote("Could not copy. Select the text after Download image instead.");
    }
  }

  async function shareProfit() {
    const text = profitShareText(sharePayload);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Eminent Corpus", text });
        setShareNote("Shared.");
        return;
      } catch {
        /* user cancelled or share failed — fall through to copy */
      }
    }
    await copyProfitShare();
  }

  async function downloadShareTable() {
    if (!showShareTable) {
      flushSync(() => setShowShareTable(true));
    }
    const card = shareCardRef.current;
    if (!card) {
      setShareNote("Performance card is not ready. Show the share card and try again.");
      return;
    }
    try {
      await downloadProfitSharePng(card);
      setShareNote("Saved eminent-corpus-performance.png — capital through the chart.");
    } catch {
      setShareNote("Could not save the image. Use File → Force Reload, then try again.");
    }
  }

  async function copySegmentShare() {
    const text = segmentShareText(segmentSharePayload);
    try {
      await navigator.clipboard.writeText(text);
      setShareNote("Copied by-segment table. Paste into WhatsApp, X, or a caption.");
    } catch {
      setShareNote("Could not copy. Show the by-segment card and copy from there.");
    }
  }

  async function shareSegment() {
    const text = segmentShareText(segmentSharePayload);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Eminent Corpus · by segment", text });
        setShareNote("Shared by-segment table.");
        return;
      } catch {
        /* cancelled */
      }
    }
    await copySegmentShare();
  }

  async function downloadSegmentShare() {
    if (!showSegmentShare) {
      flushSync(() => setShowSegmentShare(true));
    }
    const card = segmentShareRef.current;
    if (!card) {
      setShareNote("By-segment card is not ready. Show the share card and try again.");
      return;
    }
    try {
      await downloadSegmentSharePng(card);
      setShareNote("Saved eminent-corpus-by-segment.png.");
    } catch {
      setShareNote("Could not save the by-segment image. Use File → Force Reload, then try again.");
    }
  }

  function setView(next: "all" | TradeAccount) {
    const nextCapital = capitalForView(next, totalCapital, accountCapitals);
    setBookView(next);
    setSegmentView("all");
    setSelected([]);
    setEditingId(null);
    setEditCapital(false);
    setCapitalText(nextCapital > 0 ? String(nextCapital) : "");
    if (next !== "all") setForm((f) => ({ ...f, account: next }));
  }

  function setSegment(next: "all" | TradeSegment) {
    setSegmentView(next);
    setSelected([]);
    setEditingId(null);
    if (next !== "all") setForm((f) => ({ ...f, segment: next }));
  }

  const persistBook = useCallback(async () => {
    const book: PositionBook = {
      positions,
      summary: Object.values(summaries)[0] ?? null,
      summaries,
      totalCapital,
      accountCapitals,
    };
    setSaveBusy(true);
    setError(null);
    savePositionBook(book);
    try {
      const res = await fetch("/api/portfolio/positions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(book),
      });
      if (!res.ok) throw new Error("Save failed");
      setPersist("disk");
      setDirty(false);
    } catch {
      setPersist("error");
      setError("Could not save the book. Try Save again.");
    } finally {
      setSaveBusy(false);
    }
  }, [positions, summaries, totalCapital, accountCapitals]);

  useHeaderSave({ dirty, busy: saveBusy, onSave: persistBook });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const symbol = form.symbol.trim().toUpperCase();
    if (!symbol) {
      setError("Enter a ticker.");
      return;
    }
    if (!(form.qty > 0) || !(form.price > 0)) {
      setError("Quantity and price must be greater than zero.");
      return;
    }
    const notional = form.qty * form.price;
    const id = `${positionId(form.account, form.segment, symbol)}-${Date.now()}`;
    const openQty = form.side === "Buy" ? form.qty : -form.qty;
    const row: PositionLine = {
      id,
      symbol,
      isin: "",
      from: form.date,
      to: form.date,
      buyDate: form.side === "Buy" ? form.date : "",
      sellDate: form.side === "Sell" ? form.date : "",
      quantity: form.qty,
      buyValue: form.side === "Buy" ? notional : 0,
      sellValue: form.side === "Sell" ? notional : 0,
      buyPrice: form.side === "Buy" ? form.price : 0,
      sellPrice: form.side === "Sell" ? form.price : 0,
      riskAmount: 0,
      realizedPnl: form.side === "Sell" ? notional : -notional,
      realizedPnlPct: 0,
      prevClose: form.price,
      openQty,
      openQtyType: form.side === "Buy" ? "Long" : "Short",
      openValue: notional,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      side: form.side === "Sell" ? "short" : "long",
      account: form.account,
      segment: form.segment,
      source: "desk",
      notes: form.notes.trim(),
    };
    setPositions((prev) => [row, ...prev]);
    setForm((prev) => ({
      ...emptyPositionForm(),
      account: prev.account,
      segment: prev.segment,
      date: prev.date,
    }));
    setError(null);
    setDirty(true);
  }

  function startEdit(row: PositionLine) {
    setEditingId(row.id);
    setEditBuy(toDayMonthYear(row.buyDate));
    setEditSell(toDayMonthYear(row.sellDate));
    const buy = buyAvg(row);
    const sell = sellAvg(row);
    setEditBuyPx(buy ? String(Number(buy.toFixed(4))) : "");
    setEditSellPx(sell ? String(Number(sell.toFixed(4))) : "");
    setEditQty(row.quantity ? String(row.quantity) : "");
    setEditSide(inferBookSide(row));
    setEditRisk(row.riskAmount > 0 ? String(Number(row.riskAmount.toFixed(2))) : "");
  }

  function saveEdit() {
    if (!editingId) return;
    const buyIso = toIsoDate(editBuy);
    const sellIso = toIsoDate(editSell);
    if (editBuy.trim() && !buyIso) {
      setError("Buy date must be dd-mm-yyyy.");
      return;
    }
    if (editSell.trim() && !sellIso) {
      setError("Sell date must be dd-mm-yyyy.");
      return;
    }
    if (buyIso && sellIso) {
      if (editSide === "long" && sellIso < buyIso) {
        setError("On a long, sell date cannot be before buy date.");
        return;
      }
      if (editSide === "short" && buyIso < sellIso) {
        setError("On a short, buy (cover) date cannot be before sell date.");
        return;
      }
    }
    const buyPx = editBuyPx === "" ? 0 : Number(editBuyPx);
    const sellPx = editSellPx === "" ? 0 : Number(editSellPx);
    const qty = editQty === "" ? 0 : Number(editQty);
    const riskAmt = editRisk === "" ? 0 : Number(editRisk);
    if (editQty !== "" && !(qty > 0)) {
      setError("Quantity must be greater than zero.");
      return;
    }
    if (editBuyPx !== "" && !(buyPx > 0)) {
      setError("Buy price must be greater than zero.");
      return;
    }
    if (editSellPx !== "" && !(sellPx > 0)) {
      setError("Sell price must be greater than zero.");
      return;
    }
    if (editRisk !== "" && !(riskAmt > 0)) {
      setError("Risk amount must be greater than zero.");
      return;
    }
    setPositions((prev) =>
      prev.map((row) => {
        if (row.id !== editingId) return row;
        return applyTradePrices(
          {
            ...row,
            buyDate: buyIso,
            sellDate: sellIso,
            quantity: qty > 0 ? qty : row.quantity,
            side: editSide,
            openQtyType: editSide === "short" ? "Short" : "Long",
            riskAmount: riskAmt,
          },
          buyPx,
          sellPx,
        );
      }),
    );
    setEditingId(null);
    setError(null);
    setDirty(true);
  }

  function openJournal(row: PositionLine) {
    setJournalId(row.id);
    setJournalText(row.notes ?? "");
  }

  function saveJournal() {
    if (!journalId) return;
    const text = journalText.trim();
    setPositions((prev) => prev.map((row) => (row.id === journalId ? { ...row, notes: text } : row)));
    setJournalId(null);
    setJournalText("");
    setError(null);
    setDirty(true);
  }

  function removeRow(id: string) {
    setPositions((prev) => prev.filter((row) => row.id !== id));
    setSelected((prev) => prev.filter((sid) => sid !== id));
    setDirty(true);
  }

  function toggleRow(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]));
  }

  function toggleAll() {
    setSelected(allSelected ? [] : viewRows.map((row) => row.id));
  }

  function removeSelected() {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} position row${selected.length === 1 ? "" : "s"}?`)) {
      return;
    }
    const drop = new Set(selected);
    setPositions((prev) => prev.filter((row) => !drop.has(row.id)));
    setSelected([]);
    setDirty(true);
  }

  async function applyImport(res: Response) {
    const body = (await res.json()) as {
      ok?: boolean;
      error?: string;
      kind?: string;
      added?: number;
      skipped?: number;
      file?: string;
      warnings?: string[];
      positions?: unknown;
      summary?: unknown;
      summaries?: unknown;
    };
    if (!res.ok || body.error) throw new Error(body.error ?? res.statusText);
    if (body.kind === "pnl") {
      const book = parsePositionBook({
        positions: body.positions,
        summary: body.summary,
        summaries: body.summaries,
      });
      const merged = mergeFilePositions(positions, book.positions);
      const nextSummaries = { ...summaries, ...book.summaries };
      const nextBook = {
        positions: merged,
        summary: book.summary,
        summaries: nextSummaries,
        totalCapital,
        accountCapitals,
      };
      setPositions(merged);
      setSummaries(nextSummaries);
      savePositionBook(nextBook);
      setSelected([]);
      const account = book.summary ? accountLabel(book.summary.account) : "file";
      const segment = book.summary ? segmentLabel(book.summary.segment) : "segment";
      const range =
        book.summary?.from && book.summary?.to
          ? ` ${formatDate(book.summary.from)} → ${formatDate(book.summary.to)}.`
          : "";
      setImportMsg(
        `Added ${body.added ?? 0} names from the file for ${account} · ${segment} (${body.skipped ?? 0} skipped). Existing names in that segment stay; matching symbols are updated. Book now has ${merged.length} names.${range}`,
      );
      setDirty(false);
    } else {
      setImportMsg(
        `That file is a tradebook, not a P&L. Upload pnl-TR8076.xlsx (one row per stock).`,
      );
    }
    setPersist("disk");
  }

  async function uploadWorkbook(file: File) {
    setImportBusy(true);
    setImportMsg(null);
    setError(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/portfolio/import", { method: "POST", body: data });
      await applyImport(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function fetchFromFolder() {
    if (dirty) return;
    setImportBusy(true);
    setImportMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/import", { cache: "no-store" });
      await applyImport(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Autofetch failed");
    } finally {
      setImportBusy(false);
    }
  }

  useEffect(() => {
    if (!autoFetch) return;
    void fetchFromFolder();
    const t = window.setInterval(() => {
      void fetchFromFolder();
    }, 20000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll folder while toggle is on
  }, [autoFetch]);

  return (
    <div className="flex w-full flex-1 flex-col gap-4 px-4 py-4 md:px-8 md:py-5">
      <header className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-center">
        <h1 className="font-heading text-xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground text-xs">
          Net = realized + other C/D − charges
          {persist === "disk" ? " · disk" : persist === "error" ? " · disk failed" : " · this browser"}
          {dirty ? " · unsaved" : ""}
        </p>
      </header>

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-5 md:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] md:items-start">
      <aside className="flex min-w-0 w-full flex-col gap-3 md:sticky md:top-[calc(var(--desk-nav-h,4rem)+0.75rem)] md:max-h-[calc(100vh-var(--desk-nav-h,4rem)-1.5rem)] md:overflow-y-auto">
      <section className="flex flex-col gap-3">
        <p className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
          Books
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setView("all")}
            className={`rounded-xl border px-4 py-3 text-left ${
              bookView === "all" ? "border-foreground/35 bg-card text-foreground" : "border-border bg-transparent"
            }`}
          >
            <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">All accounts</p>
            <p className="mt-1 font-medium">Dashboard</p>
            <p className="mt-2 font-mono text-sm tabular-nums text-muted-foreground">
              {positions.length} names · 3 books
            </p>
            <p className={`mt-1 font-mono text-lg tabular-nums ${pnlClass(allBook.netPnl)}`}>
              {money(allBook.netPnl)}
            </p>
            <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
              Capital {totalCapital > 0 ? money(totalCapital) : "—"}
            </p>
          </button>
          {ACCOUNTS.map((account) => {
            const slice = allBook.byAccount.find((row) => row.id === account.id);
            const names = slice?.trades ?? 0;
            const pnl = slice?.totalPnl ?? 0;
            const capital = accountCapitals[account.id] ?? 0;
            const on = bookView === account.id;
            return (
              <div key={account.id} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setView(account.id)}
                  className={`rounded-xl border px-4 py-3 text-left ${
                    on ? "border-foreground/35 bg-card text-foreground" : "border-border bg-transparent"
                  }`}
                >
                  <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                    {account.broker === account.label ? "Account" : account.broker}
                  </p>
                  <p className="mt-1 font-medium">{account.label}</p>
                  <p className="mt-2 font-mono text-sm tabular-nums text-muted-foreground">{names} names</p>
                  <p className={`mt-1 font-mono text-lg tabular-nums ${pnlClass(pnl)}`}>{money(pnl)}</p>
                  <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                    Capital {capital > 0 ? money(capital) : "—"}
                  </p>
                </button>
                {on ? (
                  <div className="ml-3 flex flex-col gap-1.5 border-l border-border pl-3">
                    <p className="text-muted-foreground pt-1 text-[10px] tracking-[0.18em] uppercase">
                      Segments
                    </p>
                    <button
                      type="button"
                      onClick={() => setSegment("all")}
                      className={`rounded-lg border px-3 py-2 text-left ${
                        segmentView === "all"
                          ? "border-foreground/35 bg-card text-foreground"
                          : "border-border bg-transparent"
                      }`}
                    >
                      <p className="text-sm font-medium">All segments</p>
                      <p className={`mt-0.5 font-mono text-sm tabular-nums ${pnlClass(accountBook.netPnl)}`}>
                        {money(accountBook.netPnl)} · {accountRows.length} names
                      </p>
                    </button>
                    {SEGMENTS.map((segment) => {
                      const rows = accountRows.filter((row) => row.segment === segment.id);
                      const segPnl = rows.reduce((sum, row) => sum + row.realizedPnl, 0);
                      const selected = segmentView === segment.id;
                      return (
                        <button
                          key={segment.id}
                          type="button"
                          onClick={() => setSegment(segment.id)}
                          className={`rounded-lg border px-3 py-2 text-left ${
                            selected
                              ? "border-foreground/35 bg-card text-foreground"
                              : "border-border bg-transparent"
                          }`}
                        >
                          <p className="text-sm font-medium">{segment.label}</p>
                          <p className={`mt-0.5 font-mono text-sm tabular-nums ${pnlClass(segPnl)}`}>
                            {money(segPnl)} · {rows.length} names
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void uploadWorkbook(file);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="xs" disabled={importBusy} onClick={() => fileRef.current?.click()}>
            {importBusy ? "Reading…" : "Upload"}
          </Button>
          <Button type="button" variant="outline" size="xs" disabled={importBusy} onClick={() => void fetchFromFolder()}>
            Folder
          </Button>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={autoFetch}
              onChange={(e) => setAutoFetch(e.target.checked)}
            />
            Auto
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="xs" onClick={() => void copyProfitShare()}>
              Copy
            </Button>
            <Button type="button" variant="outline" size="xs" onClick={() => void downloadShareTable()}>
              Download
            </Button>
            <Button type="button" size="xs" onClick={() => void shareProfit()}>
              Share
            </Button>
          </div>
        </div>
        {importMsg ? <p className="mt-1 text-xs text-muted-foreground">{importMsg}</p> : null}
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
        {shareNote ? <p className="mt-1 text-xs text-muted-foreground">{shareNote}</p> : null}
      </div>

      <section className="border-border grid grid-cols-2 gap-x-6 gap-y-6 border-y py-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <div className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground truncate text-[10px] tracking-[0.14em] uppercase">
              Total capital
            </p>
            <Button
              type="button"
              variant={editCapital ? "default" : "outline"}
              size="xs"
              onClick={() => {
                if (editCapital) {
                  setEditCapital(false);
                  setCapitalText(viewCapital > 0 ? String(viewCapital) : "");
                  return;
                }
                setCapitalText(viewCapital > 0 ? String(viewCapital) : "");
                setEditCapital(true);
              }}
            >
              {editCapital ? "Done" : "Edit"}
            </Button>
          </div>
          {editCapital ? (
            <Input
              id="total-capital"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="e.g. 1000000"
              className="mt-2 h-9 bg-card font-mono text-foreground"
              value={capitalText}
              onChange={(e) => {
                const raw = e.target.value;
                setCapitalText(raw);
                const n = Number(raw.replace(/,/g, ""));
                const next = Number.isFinite(n) && n > 0 ? n : 0;
                if (bookView === "all") setTotalCapital(next);
                else setAccountCapitals((prev) => ({ ...prev, [bookView]: next }));
                setDirty(true);
              }}
            />
          ) : (
            <p className="mt-2 font-mono text-lg tracking-tight break-all tabular-nums md:text-xl">
              {viewCapital > 0 ? money(viewCapital) : "—"}
            </p>
          )}
        </div>
        <Stat
          label="From"
          value={formatDate(viewSummary?.from || viewRows[0]?.from)}
        />
        <Stat
          label="To"
          value={formatDate(viewSummary?.to || viewRows[0]?.to)}
        />
        <Stat label="Stocks" value={String(viewRows.length)} />
        <Stat label="Open" value={String(analytics.openCount)} />
        <Stat label="Realized P&L" value={money(analytics.realized)} tone={analytics.realized} />
        <Stat
          label="Return on capital"
          value={rocBeforeCharges == null ? "—" : formatPct(rocBeforeCharges)}
          tone={rocBeforeCharges == null ? undefined : rocBeforeCharges}
        />
        <Stat label="Charges" value={money(-analytics.costs)} tone={-analytics.costs} />
        <Stat
          label="Other C/D"
          value={money(viewSummary?.otherCreditDebit ?? 0)}
          tone={viewSummary?.otherCreditDebit}
        />
        <Stat label="Net P&L" value={money(analytics.netPnl)} tone={analytics.netPnl} />
        <Stat
          label="Net return on capital"
          value={roc == null ? "—" : formatPct(roc)}
          tone={roc == null ? undefined : roc}
        />
      </section>
      <p className="text-muted-foreground mt-3 text-xs">
        Figures
        {bookView === "all"
          ? " across all three accounts"
          : ` for ${accountLabel(bookView)}${segmentView === "all" ? " · all segments" : ` · ${segmentLabel(segmentView)}`}`}
        , from the P&amp;L names (row sum). Unrealized P&amp;L is ignored. Net = realized + other C/D − charges.
        {viewSummary?.from ? ` Period ${formatDate(viewSummary.from)} to ${formatDate(viewSummary.to)}.` : ""}{" "}
        {viewCapital > 0
          ? `Return on ${money(viewCapital)} capital is ${roc == null ? "—" : formatPct(roc)}.`
          : "Click Edit on Total capital to score return on the book."}{" "}
        {editCapital
          ? ` ${bookView === "all" ? "Desk" : accountLabel(bookView)} capital in INR. Return uses this base, not buy value. Save in the header after you change it.`
          : ""}
        Figures in INR.
      </p>

      <section>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
              Vs Nifty 50 · Smallcap 100
            </h2>
            <p className="text-muted-foreground mt-2 text-xs">
              Same dates as this view. Book is net return on capital. Nifty 50 from Yahoo daily close;
              Smallcap 100 from NSE EOD when Yahoo has no history. Not a recommendation.
            </p>
          </div>
          <FeedSource>Yahoo · NSE</FeedSource>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          <Stat
            label="Book"
            value={roc == null ? "—" : formatPct(roc)}
            tone={roc == null ? undefined : roc}
          />
          <Stat
            label="Nifty 50"
            value={bench?.nifty50 == null ? "—" : formatPct(bench.nifty50)}
            tone={bench?.nifty50 ?? undefined}
          />
          <Stat
            label="Vs Nifty 50"
            value={roc == null || bench?.nifty50 == null ? "—" : formatPct(roc - bench.nifty50)}
            tone={roc == null || bench?.nifty50 == null ? undefined : roc - bench.nifty50}
          />
          <Stat
            label="Smallcap 100"
            value={bench?.smallcap == null ? "—" : formatPct(bench.smallcap)}
            tone={bench?.smallcap ?? undefined}
          />
          <Stat
            label="Vs Smallcap 100"
            value={roc == null || bench?.smallcap == null ? "—" : formatPct(roc - bench.smallcap)}
            tone={roc == null || bench?.smallcap == null ? undefined : roc - bench.smallcap}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
            Total portfolio
          </h2>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => setShowShareTable((open) => !open)}
          >
            {showShareTable ? "Hide share card" : "Show share card"}
          </Button>
        </div>
        <p className="text-muted-foreground -mt-2 mb-4 text-xs">
          Cumulative net (realized + other C/D − charges) for this view. Names plot on the exit date
          (sell for longs, buy/cover for shorts); the rest use the P&amp;L period end. Copy / Download /
          Share above the figures covers this block through the chart.
        </p>
        <EquityChart
          points={curve}
          money={money}
          fillId="portfolioFill"
          ariaLabel="Total portfolio net P&L"
          emptyLabel="Upload a P&L sheet to plot the book."
        />
        {showShareTable ? (
          <div className="mt-6">
            <ProfitShareCard payload={sharePayload} cardRef={shareCardRef} />
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="text-muted-foreground mb-4 text-[11px] font-medium tracking-[0.24em] uppercase">
          Hit rate
        </h2>
        <p className="text-muted-foreground -mt-2 mb-4 text-xs">
          By entry date (buy date on longs, sell date on shorts). A hit is realized P&amp;L above zero.
          Scratch and still-open names (≈ ₹0) sit in the name count but not the rate. Quarters follow
          the Indian FY (April start).
          {hitRates.names - hitRates.dated > 0
            ? ` ${hitRates.names - hitRates.dated} name${hitRates.names - hitRates.dated === 1 ? "" : "s"} have no entry date.`
            : ""}
        </p>
        {hitRates.dated === 0 ? (
          <p className="text-muted-foreground text-sm">
            Add entry dates on names to score month and quarter hit rate.
          </p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            <HitRateTable title="By month" rows={hitRates.months} />
            <HitRateTable title="By quarter" rows={hitRates.quarters} />
          </div>
        )}
        {hitRates.dated > 0 ? (
          <p className="text-muted-foreground mt-4 text-xs">
            Overall {hitRates.hits} hit{hitRates.hits === 1 ? "" : "s"} / {hitRates.misses} miss
            {hitRates.misses === 1 ? "" : "es"}
            {hitRates.hitRate == null ? "" : ` · ${formatPct(hitRates.hitRate)}`}
            {` · ${hitRates.dated} name${hitRates.dated === 1 ? "" : "s"} with an entry date.`}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-muted-foreground mb-4 text-[11px] font-medium tracking-[0.24em] uppercase">
          Profit
        </h2>
        <p className="text-muted-foreground -mt-1 mb-4 text-xs">
          Realized P&amp;L by exit date (sell on longs, buy/cover on shorts). Months, quarters, and
          Indian FY years.
          {sellProfits.names - sellProfits.dated > 0
            ? ` ${sellProfits.names - sellProfits.dated} name${sellProfits.names - sellProfits.dated === 1 ? "" : "s"} have no exit date.`
            : ""}
        </p>
        {sellProfits.dated === 0 ? (
          <p className="text-muted-foreground text-sm">
            Add exit dates on names to score month, quarter, and year profit.
          </p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <ProfitTable title="By month" rows={sellProfits.months} />
            <ProfitTable title="By quarter" rows={sellProfits.quarters} />
            <ProfitTable title="By year" rows={sellProfits.years} />
          </div>
        )}
        {sellProfits.dated > 0 ? (
          <p className="text-muted-foreground mt-4 text-xs">
            Overall {money(sellProfits.realized)} from {sellProfits.dated} name
            {sellProfits.dated === 1 ? "" : "s"} with an exit date.
          </p>
        ) : null}
      </section>

      <section
        className={
          bookView === "all"
            ? "grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]"
            : "grid gap-12"
        }
      >
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
              Realized by name
            </h2>
            {ranked.length > 0 ? (
              <Button
                type="button"
                variant={editRows ? "default" : "outline"}
                size="xs"
                onClick={() => {
                  if (editRows) setEditingId(null);
                  setEditRows((on) => !on);
                }}
              >
                {editRows ? "Done editing" : "Edit rows"}
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground -mt-3 mb-4 text-xs">
            {editRows
              ? "Edit side, dates, quantity, price, and risk. Short = sell first, buy later. Save the row, then Save the book. R:R is realized ÷ risk."
              : "Read-only until you click Edit rows. Journal is per name — write the trade, then Save the book. Short trades: set Side to Short, sell date is the open, buy date is the cover."}
          </p>
          {ranked.length === 0 ? (
            <p className="text-muted-foreground text-sm">Upload a P&amp;L sheet to rank names.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-card text-foreground">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                    <SortTh label="Symbol" column="symbol" sort={realizedSort} onSort={setRealizedSort} />
                    <SortTh label="Side" column="side" sort={realizedSort} onSort={setRealizedSort} />
                    <SortTh label="Buy date" column="buyDate" sort={realizedSort} onSort={setRealizedSort} />
                    <SortTh label="Sell date" column="sellDate" sort={realizedSort} onSort={setRealizedSort} />
                    <SortTh label="Hold" column="hold" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <SortTh label="Qty" column="quantity" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <SortTh label="Buy price" column="buyAvg" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <SortTh label="Sell price" column="sellAvg" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <SortTh label="Buy value" column="buyValue" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <SortTh label="Sell value" column="sellValue" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <SortTh label="Realized" column="realized" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <SortTh label="Risk" column="riskAmount" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <SortTh label="R:R" column="riskReward" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <SortTh label="On cap" column="onCapital" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <th className="px-3 py-3 font-medium">Journal</th>
                    {editRows ? <th className="px-4 py-3" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((row) => {
                    const editing = editRows && editingId === row.id;
                    const hold = holdingDays(
                      editing
                        ? {
                            buyDate: toIsoDate(editBuy),
                            sellDate: toIsoDate(editSell),
                            side: editSide,
                            openQtyType: editSide === "short" ? "Short" : "Long",
                            openQty: editSide === "short" ? -1 : 1,
                          }
                        : row,
                    );
                    const liveQty =
                      editing && editQty !== "" && Number(editQty) > 0 ? Number(editQty) : row.quantity;
                    const liveBuyPx = editing && editBuyPx !== "" ? Number(editBuyPx) : buyAvg(row);
                    const liveSellPx = editing && editSellPx !== "" ? Number(editSellPx) : sellAvg(row);
                    const liveBuy =
                      editing && liveQty && liveBuyPx
                        ? liveBuyPx * liveQty
                        : row.buyValue;
                    const liveSell =
                      editing && liveQty && liveSellPx
                        ? liveSellPx * liveQty
                        : row.sellValue;
                    const liveRealized = Number.isFinite(liveBuy) && Number.isFinite(liveSell)
                      ? liveSell - liveBuy
                      : row.realizedPnl;
                    const liveRisk =
                      editing && editRisk !== "" ? Number(editRisk) : row.riskAmount;
                    const liveRr = riskRewardRatio(
                      liveRealized,
                      Number.isFinite(liveRisk) ? liveRisk : 0,
                    );
                    return (
                      <Fragment key={row.id}>
                      <tr className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2 font-mono tracking-wide">{row.symbol}</td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <select
                              className="h-8 rounded-lg border border-border bg-card px-2 font-mono text-xs"
                              value={editSide}
                              onChange={(e) => setEditSide(e.target.value as BookSide)}
                              aria-label={`${row.symbol} side`}
                            >
                              <option value="long">Long</option>
                              <option value="short">Short</option>
                            </select>
                          ) : (
                            <span className="font-mono text-xs tracking-wide uppercase">
                              {inferBookSide(row)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="dd-mm-yyyy"
                              className="h-8 w-[7.5rem] rounded-lg border border-border bg-card px-2 font-mono text-xs"
                              value={editBuy}
                              onChange={(e) => setEditBuy(e.target.value)}
                              aria-label={`${row.symbol} buy date`}
                            />
                          ) : (
                            <span className="font-mono tabular-nums text-foreground/80">
                              {formatDate(row.buyDate)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="dd-mm-yyyy"
                              className="h-8 w-[7.5rem] rounded-lg border border-border bg-card px-2 font-mono text-xs"
                              value={editSell}
                              onChange={(e) => setEditSell(e.target.value)}
                              aria-label={`${row.symbol} sell date`}
                            />
                          ) : (
                            <span className="font-mono tabular-nums text-foreground/80">
                              {formatDate(row.sellDate)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                          {hold == null ? "—" : `${hold}d`}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="h-8 w-20 rounded-lg border border-border bg-card px-2 text-right font-mono text-xs"
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              aria-label={`${row.symbol} quantity`}
                            />
                          ) : (
                            <span className="font-mono tabular-nums">{formatNum(row.quantity)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="h-8 w-24 rounded-lg border border-border bg-card px-2 text-right font-mono text-xs"
                              value={editBuyPx}
                              onChange={(e) => setEditBuyPx(e.target.value)}
                              aria-label={`${row.symbol} buy price`}
                            />
                          ) : (
                            <span className="font-mono tabular-nums text-foreground/80">
                              {buyAvg(row) ? money(buyAvg(row)) : "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="h-8 w-24 rounded-lg border border-border bg-card px-2 text-right font-mono text-xs"
                              value={editSellPx}
                              onChange={(e) => setEditSellPx(e.target.value)}
                              aria-label={`${row.symbol} sell price`}
                            />
                          ) : (
                            <span className="font-mono tabular-nums text-foreground/80">
                              {sellAvg(row) ? money(sellAvg(row)) : "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {money(Number.isFinite(liveBuy) ? liveBuy : row.buyValue)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {money(Number.isFinite(liveSell) ? liveSell : row.sellValue)}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono tabular-nums ${pnlClass(liveRealized)}`}>
                          {money(liveRealized)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="h-8 w-24 rounded-lg border border-border bg-card px-2 text-right font-mono text-xs"
                              value={editRisk}
                              onChange={(e) => setEditRisk(e.target.value)}
                              aria-label={`${row.symbol} risk amount`}
                            />
                          ) : (
                            <span className="font-mono tabular-nums text-foreground/80">
                              {row.riskAmount > 0 ? money(row.riskAmount) : "—"}
                            </span>
                          )}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono tabular-nums ${
                            liveRr == null ? "text-muted-foreground" : pnlClass(liveRr)
                          }`}
                        >
                          {liveRr == null ? "—" : formatRr(liveRr)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono tabular-nums ${
                            viewCapital > 0 ? pnlClass(liveRealized) : "text-muted-foreground"
                          }`}
                        >
                          {viewCapital > 0 ? formatPct(liveRealized / viewCapital) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant={row.notes || journalId === row.id ? "default" : "outline"}
                            size="xs"
                            onClick={() =>
                              journalId === row.id ? setJournalId(null) : openJournal(row)
                            }
                          >
                            {journalId === row.id ? "Close" : row.notes ? "Journal" : "Add"}
                          </Button>
                        </td>
                        {editRows ? (
                        <td className="px-4 py-2 text-right">
                          {editing ? (
                            <div className="flex justify-end gap-1">
                              <Button type="button" size="xs" onClick={saveEdit}>
                                Save
                              </Button>
                              <Button type="button" variant="ghost" size="xs" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button type="button" variant="outline" size="xs" onClick={() => startEdit(row)}>
                              Edit
                            </Button>
                          )}
                        </td>
                        ) : null}
                      </tr>
                      {journalId === row.id ? (
                        <tr className="border-b border-border/50 bg-card/80">
                          <td colSpan={editRows ? 16 : 15} className="px-4 py-3">
                            <p className="text-muted-foreground mb-2 text-[10px] tracking-[0.18em] uppercase">
                              Journal · {row.symbol}
                              {bookView === "all" ? ` · ${accountLabel(row.account)}` : ""}
                            </p>
                            <textarea
                              value={journalText}
                              onChange={(e) => setJournalText(e.target.value)}
                              rows={4}
                              maxLength={4000}
                              placeholder="Trade journal: thesis, what you saw, what would kill the read, what you learned."
                              className="border-input bg-background text-foreground mb-2 w-full rounded-lg border px-3 py-2 text-sm leading-relaxed"
                              aria-label={`${row.symbol} journal`}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <Button type="button" size="xs" onClick={saveJournal}>
                                Save journal
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  setJournalId(null);
                                  setJournalText("");
                                }}
                              >
                                Cancel
                              </Button>
                              <span className="text-muted-foreground text-xs">
                                Then Save the book in the header so it writes to disk.
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {bookView === "all" ? (
          <div className="space-y-8">
            <div>
              <h2 className="text-muted-foreground mb-4 text-[11px] font-medium tracking-[0.24em] uppercase">
                By account
              </h2>
              <SliceTable rows={analytics.byAccount} />
            </div>
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
                  By segment
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="xs" onClick={() => void copySegmentShare()}>
                    Copy
                  </Button>
                  <Button type="button" variant="outline" size="xs" onClick={() => void downloadSegmentShare()}>
                    Download
                  </Button>
                  <Button type="button" size="xs" onClick={() => void shareSegment()}>
                    Share
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setShowSegmentShare((open) => !open)}
                  >
                    {showSegmentShare ? "Hide card" : "Show card"}
                  </Button>
                </div>
              </div>
              <SliceTable rows={analytics.bySegment} capital={viewCapital} />
              {showSegmentShare ? (
                <div className="mt-4">
                  <SegmentShareCard payload={segmentSharePayload} cardRef={segmentShareRef} />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
            Positions
            {bookView === "all" ? "" : ` · ${accountLabel(bookView)}`}
            {bookView !== "all" && segmentView !== "all" ? ` · ${segmentLabel(segmentView)}` : ""}
          </h2>
          {viewRows.length > 0 ? (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="xs" onClick={toggleAll}>
                {allSelected ? "Clear selection" : "Select all"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="xs"
                disabled={!selected.length}
                onClick={removeSelected}
              >
                Delete selected{selected.length ? ` (${selected.length})` : ""}
              </Button>
            </div>
          ) : null}
        </div>
        {!ready ? (
          <p className="text-muted-foreground text-sm">Loading book…</p>
        ) : viewRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {positions.length === 0 ? (
              <>
                No positions yet. Upload <span className="font-mono">pnl-TR8076.xlsx</span>.
              </>
            ) : bookView !== "all" && segmentView !== "all" ? (
              `No names in ${accountLabel(bookView)} · ${segmentLabel(segmentView)} yet. Upload that segment’s P&L.`
            ) : (
              `No names on ${bookView === "all" ? "the dashboard" : accountLabel(bookView)} yet. Upload that account’s P&L.`
            )}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-card text-foreground">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                  <th className="px-4 py-3 font-medium">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={toggleAll}
                      aria-label="Select all positions"
                    />
                  </th>
                  <SortTh label="Symbol" column="symbol" sort={bookSort} onSort={setBookSort} />
                  <SortTh label="From" column="from" sort={bookSort} onSort={setBookSort} />
                  <SortTh label="To" column="to" sort={bookSort} onSort={setBookSort} />
                  <SortTh label="Buy date" column="buyDate" sort={bookSort} onSort={setBookSort} />
                  <SortTh label="Sell date" column="sellDate" sort={bookSort} onSort={setBookSort} />
                  <th className="px-3 py-3 font-medium">ISIN</th>
                  <SortTh label="Qty" column="quantity" sort={bookSort} onSort={setBookSort} align="right" />
                  <SortTh label="Buy value" column="buyValue" sort={bookSort} onSort={setBookSort} align="right" />
                  <SortTh label="Buy price" column="buyAvg" sort={bookSort} onSort={setBookSort} align="right" />
                  <SortTh label="Sell value" column="sellValue" sort={bookSort} onSort={setBookSort} align="right" />
                  <SortTh label="Sell price" column="sellAvg" sort={bookSort} onSort={setBookSort} align="right" />
                  <SortTh label="Realized" column="realized" sort={bookSort} onSort={setBookSort} align="right" />
                  <SortTh label="Realized %" column="realizedPct" sort={bookSort} onSort={setBookSort} align="right" />
                  <SortTh label="Open qty" column="openQty" sort={bookSort} onSort={setBookSort} align="right" />
                  <th className="px-3 py-3 font-medium">Open type</th>
                  <SortTh label="Open value" column="openValue" sort={bookSort} onSort={setBookSort} align="right" />
                  <SortTh label="Account" column="account" sort={bookSort} onSort={setBookSort} />
                  <SortTh label="Segment" column="segment" sort={bookSort} onSort={setBookSort} />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {bookRows.map((row) => {
                  const on = selectedSet.has(row.id);
                  const rpct = row.realizedPnlPct > 1 ? row.realizedPnlPct / 100 : row.realizedPnlPct;
                  return (
                    <tr key={row.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Select ${row.symbol}`}
                        />
                      </td>
                      <td className="px-3 py-3 font-mono tracking-wide">{row.symbol}</td>
                      <td className="px-3 py-3 font-mono tabular-nums">
                        {formatDate(row.from || summaries[sliceKey(row.account, row.segment)]?.from)}
                      </td>
                      <td className="px-3 py-3 font-mono tabular-nums">
                        {formatDate(row.to || summaries[sliceKey(row.account, row.segment)]?.to)}
                      </td>
                      <td className="px-3 py-3 font-mono tabular-nums">{formatDate(row.buyDate)}</td>
                      <td className="px-3 py-3 font-mono tabular-nums">{formatDate(row.sellDate)}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{row.isin || "—"}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNum(row.quantity)}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{money(row.buyValue)}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {buyAvg(row) ? money(buyAvg(row)) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{money(row.sellValue)}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {sellAvg(row) ? money(sellAvg(row)) : "—"}
                      </td>
                      <td className={`px-3 py-3 text-right font-mono tabular-nums ${pnlClass(row.realizedPnl)}`}>
                        {money(row.realizedPnl)}
                      </td>
                      <td className={`px-3 py-3 text-right font-mono tabular-nums ${pnlClass(row.realizedPnl)}`}>
                        {row.realizedPnlPct ? formatPct(rpct) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNum(row.openQty)}</td>
                      <td className="px-3 py-3">{row.openQtyType || (row.openQty ? "Open" : "Flat")}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{money(row.openValue)}</td>
                      <td className="px-3 py-3 text-xs">{accountLabel(row.account)}</td>
                      <td className="px-3 py-3 text-xs">{segmentLabel(row.segment)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button type="button" variant="ghost" size="xs" onClick={() => removeRow(row.id)}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-muted-foreground mb-5 text-[11px] font-medium tracking-[0.24em] uppercase">
          Add position
        </h2>
        <form
          onSubmit={onSubmit}
          className="grid gap-4 rounded-xl bg-card p-4 text-foreground md:grid-cols-4 lg:grid-cols-8 lg:items-end"
        >
          <Field label="Date" htmlFor="pos-date">
            <Input
              id="pos-date"
              type="date"
              className={fieldClass}
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </Field>
          <Field label="Account" htmlFor="pos-account">
            <select
              id="pos-account"
              className={fieldClass}
              value={form.account}
              onChange={(e) => setForm((f) => ({ ...f, account: e.target.value as TradeAccount }))}
            >
              {ACCOUNTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.broker} {a.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Segment" htmlFor="pos-segment">
            <select
              id="pos-segment"
              className={fieldClass}
              value={form.segment}
              onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value as TradeSegment }))}
            >
              {SEGMENTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Symbol" htmlFor="pos-symbol">
            <Input
              id="pos-symbol"
              className={`${fieldClass} uppercase`}
              placeholder="RELIANCE"
              value={form.symbol}
              onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
              required
            />
          </Field>
          <Field label="Side" htmlFor="pos-side">
            <select
              id="pos-side"
              className={fieldClass}
              value={form.side}
              onChange={(e) => setForm((f) => ({ ...f, side: e.target.value as TradeSide }))}
            >
              <option value="Buy">Buy</option>
              <option value="Sell">Sell</option>
            </select>
          </Field>
          <Field label="Quantity" htmlFor="pos-qty">
            <Input
              id="pos-qty"
              type="number"
              min="0"
              step="any"
              className={fieldClass}
              value={form.qty || ""}
              onChange={(e) => setForm((f) => ({ ...f, qty: Number(e.target.value) }))}
              required
            />
          </Field>
          <Field label="Price" htmlFor="pos-price">
            <Input
              id="pos-price"
              type="number"
              min="0"
              step="any"
              className={fieldClass}
              value={form.price || ""}
              onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
              required
            />
          </Field>
          <div className="flex h-8 items-center gap-2">
            <Button type="submit" className="h-8">
              Add
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8"
              disabled={!dirty || saveBusy}
              onClick={() => void persistBook()}
            >
              {saveBusy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </section>
      </div>
      </div>
    </div>
  );
}

function SortTh({
  label,
  column,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortKey;
  sort: SortState;
  onSort: (next: SortState) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === column;
  const mark = !active ? "" : sort.dir === "asc" ? " ↑" : " ↓";
  return (
    <th className={`px-3 py-3 font-medium ${align === "right" ? "text-right" : "text-left"} first:px-4`}>
      <button
        type="button"
        className={`tracking-[0.18em] uppercase ${active ? "text-foreground" : "text-muted-foreground"}`}
        onClick={() => onSort(toggleSort(sort, column))}
      >
        {label}
        {mark}
      </button>
    </th>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function formatHitRate(n: number | null) {
  if (n == null) return "—";
  const digits = n === 0 || n === 1 ? 0 : 2;
  return `${(n * 100).toFixed(digits)}%`;
}

function HitRateTable({ title, rows }: { title: string; rows: HitRateBucket[] }) {
  return (
    <div>
      <h3 className="text-muted-foreground mb-3 text-[10px] tracking-[0.18em] uppercase">{title}</h3>
      <div className="overflow-x-auto rounded-xl bg-card text-foreground">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              <th className="px-4 py-2 font-medium">Period</th>
              <th className="px-3 py-2 text-right font-medium">Names</th>
              <th className="px-3 py-2 text-right font-medium">Hits</th>
              <th className="px-3 py-2 text-right font-medium">Misses</th>
              <th className="px-3 py-2 text-right font-medium">Hit rate</th>
              <th className="px-4 py-2 text-right font-medium">Realized</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2">{row.label}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{row.names}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-gain">{row.hits}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-loss">{row.misses}</td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${
                    row.hitRate == null ? "text-muted-foreground" : pnlClass(row.hitRate - 0.5)
                  }`}
                >
                  {row.hitRate == null ? "—" : formatPct(row.hitRate)}
                </td>
                <td className={`px-4 py-2 text-right font-mono tabular-nums ${pnlClass(row.realized)}`}>
                  {money(row.realized)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProfitTable({ title, rows }: { title: string; rows: ProfitBucket[] }) {
  return (
    <div>
      <h3 className="text-muted-foreground mb-3 text-[10px] tracking-[0.18em] uppercase">{title}</h3>
      <div className="overflow-x-auto rounded-xl bg-card text-foreground">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              <th className="px-4 py-2 font-medium">Period</th>
              <th className="px-3 py-2 text-right font-medium">Names</th>
              <th className="px-4 py-2 text-right font-medium">Profit (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2">{row.label}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{row.names}</td>
                <td className={`px-4 py-2 text-right font-mono tabular-nums ${pnlClass(row.realized)}`}>
                  {money(row.realized)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SliceTable({
  rows,
  capital,
}: {
  rows: {
    id: string;
    label: string;
    trades: number;
    gross: number;
    totalPnl: number;
  }[];
  capital?: number;
}) {
  const showRoc = capital != null;
  return (
    <div className="overflow-x-auto rounded-xl bg-card text-foreground">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            <th className="px-4 py-2 font-medium">Book</th>
            <th className="px-3 py-2 text-right font-medium">Names</th>
            <th className="px-3 py-2 text-right font-medium">Gross</th>
            <th className="px-4 py-2 text-right font-medium">P&amp;L</th>
            {showRoc ? <th className="px-4 py-2 text-right font-medium">On cap</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const roc = showRoc ? returnOnCapital(row.totalPnl, capital) : null;
            return (
              <tr key={row.id} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2">{row.label}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{row.trades}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{money(row.gross)}</td>
                <td className={`px-4 py-2 text-right font-mono tabular-nums ${pnlClass(row.totalPnl)}`}>
                  {money(row.totalPnl)}
                </td>
                {showRoc ? (
                  <td
                    className={`px-4 py-2 text-right font-mono tabular-nums ${
                      roc == null ? "text-muted-foreground" : pnlClass(row.totalPnl)
                    }`}
                  >
                    {roc == null ? "—" : formatPct(roc)}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
