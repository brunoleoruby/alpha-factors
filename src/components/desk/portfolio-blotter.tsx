"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { EquityChart } from "@/components/desk/equity-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNum, formatPct, pnlClass } from "@/lib/format";
import { analyzeBook, money } from "@/lib/portfolio/analytics";
import {
  ACCOUNTS,
  SEGMENTS,
  accountLabel,
  emptyTradeForm,
  loadTrades,
  parseTradeList,
  saveTrades,
  segmentLabel,
  tradeNotional,
  type Trade,
  type TradeAccount,
  type TradeSegment,
  type TradeSide,
} from "@/lib/portfolio/trades";

const fieldClass =
  "h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm text-slate-900";

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
  const [trades, setTrades] = useState<Trade[]>([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState(emptyTradeForm);
  const [error, setError] = useState<string | null>(null);

  const [persist, setPersist] = useState<"disk" | "browser" | "error">("browser");

  useEffect(() => {
    let dead = false;
    const boot = async () => {
      const local = loadTrades();
      try {
        const res = await fetch("/api/portfolio/trades", { cache: "no-store" });
        const body = (await res.json()) as { trades?: unknown; error?: string };
        if (!res.ok) throw new Error(body.error ?? "Load failed");
        const disk = Array.isArray(body.trades) ? body.trades : [];
        const parsedDisk = parseTradeList(disk);
        if (dead) return;
        if (parsedDisk.length) {
          setTrades(parsedDisk);
          saveTrades(parsedDisk);
        } else if (local.length) {
          setTrades(local);
          await fetch("/api/portfolio/trades", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trades: local }),
          });
        } else {
          setTrades([]);
        }
        setPersist("disk");
      } catch {
        if (dead) return;
        setTrades(local);
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
    if (!ready) return;
    saveTrades(trades);
    const t = window.setTimeout(() => {
      void fetch("/api/portfolio/trades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades }),
      }).then((res) => {
        if (res.ok) setPersist("disk");
        else setPersist("error");
      }).catch(() => setPersist("error"));
    }, 200);
    return () => window.clearTimeout(t);
  }, [ready, trades]);

  const analytics = useMemo(() => analyzeBook(trades), [trades]);

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
    const trade: Trade = {
      id: crypto.randomUUID(),
      date: form.date,
      symbol,
      side: form.side,
      qty: form.qty,
      price: form.price,
      account: form.account,
      segment: form.segment,
      notes: form.notes.trim(),
    };
    setTrades((prev) => [trade, ...prev]);
    setForm((prev) => ({
      ...emptyTradeForm(),
      account: prev.account,
      segment: prev.segment,
      date: prev.date,
    }));
    setError(null);
  }

  function removeTrade(id: string) {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-10 px-4 py-10 md:px-8 md:py-14">
      <header>
        <p className="text-primary text-[11px] tracking-[0.3em] uppercase">Book</p>
        <h1 className="font-heading mt-2 text-5xl font-semibold tracking-tight md:text-6xl">
          Portfolio
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
          Three accounts — Zerodha TR8076, Zerodha VFH197, Fyers — across equity, Nifty 50, and
          commodity. Fills are written to <span className="font-mono text-foreground/80">data/trades.json</span>{" "}
          on this computer so the book is not lost when the browser is cleared.
          {persist === "disk" ? " Saved on disk." : persist === "error" ? " Disk save failed — still in this browser." : " Using this browser until disk is ready."}
        </p>
      </header>

      <section className="border-border grid grid-cols-2 gap-x-6 gap-y-6 border-y py-6 md:grid-cols-4 xl:grid-cols-8">
        <Stat label="Trades" value={String(trades.length)} />
        <Stat label="Open names" value={String(analytics.names)} />
        <Stat label="Gross" value={money(analytics.gross)} />
        <Stat label="Net" value={money(analytics.net)} tone={analytics.net} />
        <Stat label="Realized P&L" value={money(analytics.realized)} tone={analytics.realized} />
        <Stat label="Unrealized*" value={money(analytics.unrealized)} tone={analytics.unrealized} />
        <Stat label="Total P&L" value={money(analytics.totalPnl)} tone={analytics.totalPnl} />
        <Stat
          label="Hit rate"
          value={analytics.winLots + analytics.loseLots ? formatPct(analytics.winRate) : "—"}
        />
      </section>
      <p className="text-muted-foreground -mt-6 text-xs">
        *Unrealized marks last fill. FIFO per account × segment × symbol. Figures in INR.
      </p>

      <section className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
        <div>
          <h2 className="text-muted-foreground mb-5 text-[11px] font-medium tracking-[0.24em] uppercase">
            Cumulative realized P&amp;L
          </h2>
          <EquityChart
            points={analytics.daily.map((d) => ({ date: d.date, equity: d.realized }))}
            money={money}
            emptyLabel="Need two trade dates with closes to plot realized P&L."
          />
        </div>
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
      </section>

      <section>
        <h2 className="text-muted-foreground mb-5 text-[11px] font-medium tracking-[0.24em] uppercase">
          Account × segment
        </h2>
        <div className="overflow-x-auto rounded-xl bg-white text-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] tracking-[0.18em] text-slate-500 uppercase">
                <th className="px-4 py-3 font-medium">Account</th>
                {SEGMENTS.map((s) => (
                  <th key={s.id} className="px-3 py-3 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACCOUNTS.map((account) => (
                <tr key={account.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-medium">{account.broker}</span>
                    <span className="ml-2 font-mono text-xs text-slate-500">{account.label}</span>
                  </td>
                  {SEGMENTS.map((segment) => {
                    const cell = analytics.matrix.find(
                      (m) => m.account === account.id && m.segment === segment.id,
                    );
                    const pnl = cell?.realized ?? 0;
                    return (
                      <td
                        key={segment.id}
                        className={`px-3 py-3 text-right font-mono tabular-nums ${pnlClass(pnl)}`}
                      >
                        {money(pnl)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">Cells show FIFO realized P&amp;L.</p>
      </section>

      <section>
        <h2 className="text-muted-foreground mb-5 text-[11px] font-medium tracking-[0.24em] uppercase">
          Positions
        </h2>
        {analytics.positions.length === 0 ? (
          <p className="text-muted-foreground text-sm">Positions appear after the first fill.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white text-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] tracking-[0.18em] text-slate-500 uppercase">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Account</th>
                  <th className="px-3 py-3 font-medium">Segment</th>
                  <th className="px-3 py-3 font-medium">Side</th>
                  <th className="px-3 py-3 text-right font-medium">Qty</th>
                  <th className="px-3 py-3 text-right font-medium">Avg</th>
                  <th className="px-3 py-3 text-right font-medium">Last fill</th>
                  <th className="px-3 py-3 text-right font-medium">Value</th>
                  <th className="px-3 py-3 text-right font-medium">Unreal.</th>
                  <th className="px-4 py-3 text-right font-medium">Realized</th>
                </tr>
              </thead>
              <tbody>
                {analytics.positions.map((row) => (
                  <tr key={row.key} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-mono tracking-wide">{row.symbol}</td>
                    <td className="px-3 py-3 text-slate-600">{accountLabel(row.account)}</td>
                    <td className="px-3 py-3 text-slate-600">{segmentLabel(row.segment)}</td>
                    <td className="px-3 py-3">
                      {Math.abs(row.qty) < 1e-12 ? "Flat" : row.qty > 0 ? "Long" : "Short"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNum(row.qty)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {row.avgCost ? money(row.avgCost) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{money(row.lastPrice)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{money(row.marketValue)}</td>
                    <td className={`px-3 py-3 text-right font-mono tabular-nums ${pnlClass(row.unrealized)}`}>
                      {money(row.unrealized)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono tabular-nums ${pnlClass(row.realized)}`}>
                      {money(row.realized)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-muted-foreground mb-5 text-[11px] font-medium tracking-[0.24em] uppercase">
          New trade
        </h2>
        <form
          onSubmit={onSubmit}
          className="grid gap-4 rounded-xl bg-white p-4 text-slate-900 md:grid-cols-4 lg:grid-cols-8 lg:items-end"
        >
          <Field label="Date" htmlFor="trade-date">
            <Input
              id="trade-date"
              type="date"
              className={fieldClass}
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </Field>
          <Field label="Account" htmlFor="trade-account">
            <select
              id="trade-account"
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
          <Field label="Segment" htmlFor="trade-segment">
            <select
              id="trade-segment"
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
          <Field label="Symbol" htmlFor="trade-symbol">
            <Input
              id="trade-symbol"
              className={`${fieldClass} uppercase`}
              placeholder="RELIANCE"
              value={form.symbol}
              onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
              required
            />
          </Field>
          <Field label="Side" htmlFor="trade-side">
            <select
              id="trade-side"
              className={fieldClass}
              value={form.side}
              onChange={(e) => setForm((f) => ({ ...f, side: e.target.value as TradeSide }))}
            >
              <option value="Buy">Buy</option>
              <option value="Sell">Sell</option>
            </select>
          </Field>
          <Field label="Quantity" htmlFor="trade-qty">
            <Input
              id="trade-qty"
              type="number"
              min="0"
              step="any"
              className={fieldClass}
              value={form.qty || ""}
              onChange={(e) => setForm((f) => ({ ...f, qty: Number(e.target.value) }))}
              required
            />
          </Field>
          <Field label="Price" htmlFor="trade-price">
            <Input
              id="trade-price"
              type="number"
              min="0"
              step="any"
              className={fieldClass}
              value={form.price || ""}
              onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
              required
            />
          </Field>
          <Button type="submit" className="h-8">
            Add trade
          </Button>
          <div className="space-y-1.5 lg:col-span-8">
            <Label htmlFor="trade-notes" className="text-slate-600">
              Notes
            </Label>
            <Input
              id="trade-notes"
              className={fieldClass}
              placeholder="Optional"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          {error ? <p className="text-destructive lg:col-span-8 text-sm">{error}</p> : null}
        </form>
      </section>

      <section>
        <h2 className="text-muted-foreground mb-5 text-[11px] font-medium tracking-[0.24em] uppercase">
          Blotter
        </h2>
        {!ready ? (
          <p className="text-muted-foreground text-sm">Loading book…</p>
        ) : trades.length === 0 ? (
          <p className="text-muted-foreground text-sm">No fills yet. Add the first trade above.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white text-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] tracking-[0.18em] text-slate-500 uppercase">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Account</th>
                  <th className="px-3 py-3 font-medium">Segment</th>
                  <th className="px-3 py-3 font-medium">Symbol</th>
                  <th className="px-3 py-3 font-medium">Side</th>
                  <th className="px-3 py-3 text-right font-medium">Qty</th>
                  <th className="px-3 py-3 text-right font-medium">Price</th>
                  <th className="px-3 py-3 text-right font-medium">Notional</th>
                  <th className="px-3 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {trades.map((row) => {
                  const notional = tradeNotional(row);
                  return (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-mono tabular-nums">{row.date}</td>
                      <td className="px-3 py-3">{accountLabel(row.account)}</td>
                      <td className="px-3 py-3">{segmentLabel(row.segment)}</td>
                      <td className="px-3 py-3 font-mono tracking-wide">{row.symbol}</td>
                      <td className="px-3 py-3">{row.side}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNum(row.qty)}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{money(row.price)}</td>
                      <td className={`px-3 py-3 text-right font-mono tabular-nums ${pnlClass(notional)}`}>
                        {money(notional)}
                      </td>
                      <td className="max-w-[14rem] truncate px-3 py-3 text-slate-500">
                        {row.notes || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button type="button" variant="ghost" size="xs" onClick={() => removeTrade(row.id)}>
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
    </div>
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
            <th className="px-3 py-2 text-right font-medium">Trades</th>
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
