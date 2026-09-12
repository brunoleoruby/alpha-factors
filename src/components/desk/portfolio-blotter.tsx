"use client";

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHeaderSave } from "@/components/desk/header-save";
import { EquityChart } from "@/components/desk/equity-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatNum, formatPct, pnlClass } from "@/lib/format";
import { analyzePositions, money, portfolioCurve, summaryForView } from "@/lib/portfolio/analytics";
import {
  applyTradePrices,
  buyAvg,
  emptyPositionForm,
  holdingDays,
  loadPositionBook,
  parsePositionBook,
  positionId,
  mergeFilePositions,
  mergeSummaries,
  savePositionBook,
  sellAvg,
  sliceKey,
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
  "h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm text-slate-900";

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
  | "openQty"
  | "openValue"
  | "unrealized"
  | "account";

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
    case "openQty":
      return row.openQty;
    case "openValue":
      return row.openValue;
    case "unrealized":
      return row.unrealizedPnl;
    case "account":
      return row.account;
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
  return { key, dir: key === "symbol" || key === "buyDate" || key === "sellDate" || key === "from" || key === "to" || key === "account" ? "asc" : "desc" };
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">{label}</p>
      <p
        className={`mt-2 font-mono text-xl tracking-tight tabular-nums md:text-2xl ${
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
  const [editBuy, setEditBuy] = useState("");
  const [editSell, setEditSell] = useState("");
  const [editBuyPx, setEditBuyPx] = useState("");
  const [editSellPx, setEditSellPx] = useState("");
  const [realizedSort, setRealizedSort] = useState<SortState>({ key: "realized", dir: "desc" });
  const [bookSort, setBookSort] = useState<SortState>({ key: "symbol", dir: "asc" });
  const [bookView, setBookView] = useState<"all" | TradeAccount>("all");
  const [segmentView, setSegmentView] = useState<"all" | TradeSegment>("all");
  const [dirty, setDirty] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
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
          setPositions(disk.positions);
          setSummaries(disk.summaries);
          savePositionBook(disk);
        } else if (local.positions.length) {
          setPositions(local.positions);
          setSummaries(local.summaries);
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
  const curve = useMemo(() => portfolioCurve(viewRows, viewSummary), [viewRows, viewSummary]);

  function setView(next: "all" | TradeAccount) {
    setBookView(next);
    setSegmentView("all");
    setSelected([]);
    setEditingId(null);
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
  }, [positions, summaries]);

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
      realizedPnl: form.side === "Sell" ? notional : -notional,
      realizedPnlPct: 0,
      prevClose: form.price,
      openQty,
      openQtyType: form.side === "Buy" ? "Long" : "Short",
      openValue: notional,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
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
    setEditBuy(row.buyDate);
    setEditSell(row.sellDate);
    const buy = buyAvg(row);
    const sell = sellAvg(row);
    setEditBuyPx(buy ? String(Number(buy.toFixed(4))) : "");
    setEditSellPx(sell ? String(Number(sell.toFixed(4))) : "");
  }

  function saveEdit() {
    if (!editingId) return;
    if (editBuy && editSell && editSell < editBuy) {
      setError("Sell date cannot be before buy date.");
      return;
    }
    const buyPx = editBuyPx === "" ? 0 : Number(editBuyPx);
    const sellPx = editSellPx === "" ? 0 : Number(editSellPx);
    if (editBuyPx !== "" && !(buyPx > 0)) {
      setError("Buy price must be greater than zero.");
      return;
    }
    if (editSellPx !== "" && !(sellPx > 0)) {
      setError("Sell price must be greater than zero.");
      return;
    }
    setPositions((prev) =>
      prev.map((row) => {
        if (row.id !== editingId) return row;
        return applyTradePrices(
          { ...row, buyDate: editBuy, sellDate: editSell },
          buyPx,
          sellPx,
        );
      }),
    );
    setEditingId(null);
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
      const nextBook = { positions: merged, summary: book.summary, summaries: nextSummaries };
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
    <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-10 px-4 py-10 md:px-8 md:py-14">
      <header>
        <p className="text-primary text-[11px] tracking-[0.3em] uppercase">Book</p>
        <h1 className="font-heading mt-2 text-5xl font-semibold tracking-tight md:text-6xl">
          Portfolio
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
          Positions come from each account’s P&amp;L sheet. Click All for the combined dashboard, or
          TR8076 / VFH197 / Fyers for that book. After an account is open, click Equity, Nifty 50,
          or Commodity to see that sleeve. New names are added to a segment; old names stay (same
          symbol is updated). Net = realized +
          other credits/debits − charges (unrealized is ignored). Click Save in the top bar after you
          add or edit rows. Saved to{" "}
          <span className="font-mono text-foreground/80">data/positions.json</span>
          {persist === "disk"
            ? ". Saved on disk."
            : persist === "error"
              ? ". Disk save failed — still in this browser."
              : ". Using this browser until disk is ready."}
          {dirty ? " Unsaved changes." : ""}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <p className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
          Books
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => setView("all")}
            className={`rounded-xl border px-4 py-3 text-left ${
              bookView === "all" ? "border-slate-900 bg-white text-slate-900" : "border-border bg-transparent"
            }`}
          >
            <p className="text-[10px] tracking-[0.18em] text-slate-500 uppercase">All accounts</p>
            <p className="mt-1 font-medium">Dashboard</p>
            <p className="mt-2 font-mono text-sm tabular-nums text-slate-600">
              {positions.length} names · 3 books
            </p>
            <p className={`mt-1 font-mono text-lg tabular-nums ${pnlClass(allBook.netPnl)}`}>
              {money(allBook.netPnl)}
            </p>
          </button>
          {ACCOUNTS.map((account) => {
            const slice = allBook.byAccount.find((row) => row.id === account.id);
            const names = slice?.trades ?? 0;
            const pnl = slice?.totalPnl ?? 0;
            const on = bookView === account.id;
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => setView(account.id)}
                className={`rounded-xl border px-4 py-3 text-left ${
                  on ? "border-slate-900 bg-white text-slate-900" : "border-border bg-transparent"
                }`}
              >
                <p className="text-[10px] tracking-[0.18em] text-slate-500 uppercase">
                  {account.broker === account.label ? "Account" : account.broker}
                </p>
                <p className="mt-1 font-medium">{account.label}</p>
                <p className="mt-2 font-mono text-sm tabular-nums text-slate-600">{names} names</p>
                <p className={`mt-1 font-mono text-lg tabular-nums ${pnlClass(pnl)}`}>{money(pnl)}</p>
              </button>
            );
          })}
        </div>
      </section>

      {bookView !== "all" ? (
        <section className="flex flex-col gap-3">
          <p className="text-muted-foreground text-[11px] font-medium tracking-[0.24em] uppercase">
            Segments · {accountLabel(bookView)}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setSegment("all")}
              className={`rounded-xl border px-4 py-3 text-left ${
                segmentView === "all" ? "border-slate-900 bg-white text-slate-900" : "border-border bg-transparent"
              }`}
            >
              <p className="text-[10px] tracking-[0.18em] text-slate-500 uppercase">All segments</p>
              <p className="mt-1 font-medium">Account book</p>
              <p className="mt-2 font-mono text-sm tabular-nums text-slate-600">{accountRows.length} names</p>
              <p className={`mt-1 font-mono text-lg tabular-nums ${pnlClass(accountBook.netPnl)}`}>
                {money(accountBook.netPnl)}
              </p>
            </button>
            {SEGMENTS.map((segment) => {
              const rows = accountRows.filter((row) => row.segment === segment.id);
              const names = rows.length;
              const pnl = rows.reduce((sum, row) => sum + row.realizedPnl, 0);
              const on = segmentView === segment.id;
              return (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => setSegment(segment.id)}
                  className={`rounded-xl border px-4 py-3 text-left ${
                    on ? "border-slate-900 bg-white text-slate-900" : "border-border bg-transparent"
                  }`}
                >
                  <p className="text-[10px] tracking-[0.18em] text-slate-500 uppercase">Segment</p>
                  <p className="mt-1 font-medium">{segment.label}</p>
                  <p className="mt-2 font-mono text-sm tabular-nums text-slate-600">{names} names</p>
                  <p className={`mt-1 font-mono text-lg tabular-nums ${pnlClass(pnl)}`}>{money(pnl)}</p>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl bg-white p-4 text-slate-900">
        <h2 className="text-[11px] font-medium tracking-[0.24em] text-slate-500 uppercase">
          P&amp;L / positions sheet
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Upload one segment file at a time (e.g. equity, Nifty 50, commodity for TR8076). New names
          are added to that sleeve; existing names stay. Matching symbols are updated, not wiped.
          Other segments and accounts stay. Drop files in{" "}
          <span className="font-mono text-slate-800">data/imports</span> or choose here.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
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
          <Button type="button" disabled={importBusy} onClick={() => fileRef.current?.click()}>
            {importBusy ? "Reading…" : "Upload P&L"}
          </Button>
          <Button type="button" variant="outline" disabled={importBusy} onClick={() => void fetchFromFolder()}>
            Fetch from folder
          </Button>
          <label className="ml-2 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={autoFetch}
              onChange={(e) => setAutoFetch(e.target.checked)}
            />
            Autofetch every 20s
          </label>
        </div>
        {importMsg ? <p className="mt-3 text-sm text-slate-600">{importMsg}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="border-border grid grid-cols-2 gap-x-6 gap-y-6 border-y py-6 md:grid-cols-4 xl:grid-cols-8">
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
        <Stat label="Realized" value={money(analytics.realized)} tone={analytics.realized} />
        <Stat label="Charges" value={money(-analytics.costs)} tone={-analytics.costs} />
        <Stat
          label="Other C/D"
          value={money(viewSummary?.otherCreditDebit ?? 0)}
          tone={viewSummary?.otherCreditDebit}
        />
        <Stat label="Net P&L" value={money(analytics.netPnl)} tone={analytics.netPnl} />
        <Stat
          label="Open weight"
          value={analytics.topWeight ? formatPct(analytics.topWeight) : "—"}
          tone={analytics.concentrated ? -1 : undefined}
        />
      </section>
      <p className="text-muted-foreground -mt-6 text-xs">
        Figures
        {bookView === "all"
          ? " across all three accounts"
          : ` for ${accountLabel(bookView)}${segmentView === "all" ? " · all segments" : ` · ${segmentLabel(segmentView)}`}`}
        , from the P&amp;L names (row sum). Unrealized P&amp;L is ignored. Net = realized + other C/D − charges.
        {viewSummary?.from ? ` Period ${formatDate(viewSummary.from)} to ${formatDate(viewSummary.to)}.` : ""} Figures in INR.
      </p>

      <section>
        <h2 className="text-muted-foreground mb-4 text-[11px] font-medium tracking-[0.24em] uppercase">
          Total portfolio
        </h2>
        <p className="text-muted-foreground -mt-2 mb-4 text-xs">
          Cumulative net (realized + other C/D − charges) for this view. Names with a sell date plot
          on that day; the rest use the P&amp;L period end.
        </p>
        <EquityChart
          points={curve}
          money={money}
          fillId="portfolioFill"
          ariaLabel="Total portfolio net P&L"
          emptyLabel="Upload a P&L sheet to plot the book."
        />
      </section>

      <section
        className={
          bookView === "all"
            ? "grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]"
            : "grid gap-12"
        }
      >
        <div>
          <h2 className="text-muted-foreground mb-5 text-[11px] font-medium tracking-[0.24em] uppercase">
            Realized by name
          </h2>
          <p className="text-muted-foreground -mt-3 mb-4 text-xs">
            P&amp;L file has no fill dates or trade prices. Edit a name to type buy/sell date and
            price, save the row, then Save the book. Dates and prices stay when you re-upload the
            sheet.
          </p>
          {ranked.length === 0 ? (
            <p className="text-muted-foreground text-sm">Upload a P&amp;L sheet to rank names.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-white text-slate-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[10px] tracking-[0.18em] text-slate-500 uppercase">
                    <SortTh label="Symbol" column="symbol" sort={realizedSort} onSort={setRealizedSort} />
                    <SortTh label="Buy date" column="buyDate" sort={realizedSort} onSort={setRealizedSort} />
                    <SortTh label="Sell date" column="sellDate" sort={realizedSort} onSort={setRealizedSort} />
                    <SortTh label="Hold" column="hold" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <SortTh label="Buy price" column="buyAvg" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <SortTh label="Sell price" column="sellAvg" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <SortTh label="Buy value" column="buyValue" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <SortTh label="Sell value" column="sellValue" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <SortTh label="Realized" column="realized" sort={realizedSort} onSort={setRealizedSort} align="right" />
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((row) => {
                    const editing = editingId === row.id;
                    const hold = holdingDays(editing ? { buyDate: editBuy, sellDate: editSell } : row);
                    const liveBuy =
                      editing && editBuyPx !== "" && row.quantity
                        ? Number(editBuyPx) * row.quantity
                        : row.buyValue;
                    const liveSell =
                      editing && editSellPx !== "" && row.quantity
                        ? Number(editSellPx) * row.quantity
                        : row.sellValue;
                    const liveRealized = Number.isFinite(liveBuy) && Number.isFinite(liveSell)
                      ? liveSell - liveBuy
                      : row.realizedPnl;
                    return (
                      <tr key={row.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2 font-mono tracking-wide">{row.symbol}</td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <input
                              type="date"
                              className="h-8 rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs"
                              value={editBuy}
                              onChange={(e) => setEditBuy(e.target.value)}
                              aria-label={`${row.symbol} buy date`}
                            />
                          ) : (
                            <span className="font-mono tabular-nums text-slate-700">
                              {formatDate(row.buyDate)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <input
                              type="date"
                              className="h-8 rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs"
                              value={editSell}
                              onChange={(e) => setEditSell(e.target.value)}
                              aria-label={`${row.symbol} sell date`}
                            />
                          ) : (
                            <span className="font-mono tabular-nums text-slate-700">
                              {formatDate(row.sellDate)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">
                          {hold == null ? "—" : `${hold}d`}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="h-8 w-24 rounded-lg border border-slate-200 bg-white px-2 text-right font-mono text-xs"
                              value={editBuyPx}
                              onChange={(e) => setEditBuyPx(e.target.value)}
                              aria-label={`${row.symbol} buy price`}
                            />
                          ) : (
                            <span className="font-mono tabular-nums text-slate-700">
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
                              className="h-8 w-24 rounded-lg border border-slate-200 bg-white px-2 text-right font-mono text-xs"
                              value={editSellPx}
                              onChange={(e) => setEditSellPx(e.target.value)}
                              aria-label={`${row.symbol} sell price`}
                            />
                          ) : (
                            <span className="font-mono tabular-nums text-slate-700">
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
                      </tr>
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
              <h2 className="text-muted-foreground mb-4 text-[11px] font-medium tracking-[0.24em] uppercase">
                By segment
              </h2>
              <SliceTable rows={analytics.bySegment} />
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
          <div className="overflow-x-auto rounded-xl bg-white text-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] tracking-[0.18em] text-slate-500 uppercase">
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
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {bookRows.map((row) => {
                  const on = selectedSet.has(row.id);
                  const rpct = row.realizedPnlPct > 1 ? row.realizedPnlPct / 100 : row.realizedPnlPct;
                  return (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
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
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">{row.isin || "—"}</td>
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
          className="grid gap-4 rounded-xl bg-white p-4 text-slate-900 md:grid-cols-4 lg:grid-cols-8 lg:items-end"
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
        className={`tracking-[0.18em] uppercase ${active ? "text-slate-800" : "text-slate-500"}`}
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
      <Label htmlFor={htmlFor} className="text-slate-600">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SliceTable({
  rows,
}: {
  rows: {
    id: string;
    label: string;
    trades: number;
    gross: number;
    totalPnl: number;
  }[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white text-slate-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[10px] tracking-[0.18em] text-slate-500 uppercase">
            <th className="px-4 py-2 font-medium">Book</th>
            <th className="px-3 py-2 text-right font-medium">Names</th>
            <th className="px-3 py-2 text-right font-medium">Gross</th>
            <th className="px-4 py-2 text-right font-medium">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2">{row.label}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{row.trades}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{money(row.gross)}</td>
              <td className={`px-4 py-2 text-right font-mono tabular-nums ${pnlClass(row.totalPnl)}`}>
                {money(row.totalPnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
