import type { ReactNode } from "react";
import { EquityChart } from "@/components/desk/equity-chart";
import { FeedSource } from "@/components/desk/feed-source";
import { LiveBookStrip } from "@/components/desk/live-book-strip";
import { FUND, NAV_SERIES, POSITIONS, RISK_NOTES, SLEEVES } from "@/lib/fund/book";
import { formatPct, formatUsd, pnlClass } from "@/lib/format";

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: number;
}) {
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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-muted-foreground mb-5 text-[11px] font-medium tracking-[0.24em] uppercase">
      {children}
    </h2>
  );
}

export function FundDashboard() {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-12 px-4 py-10 md:px-8 md:py-14">
      <header className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-3 duration-700">
        <p className="text-primary/90 text-[11px] tracking-[0.3em] uppercase">Partner dashboard</p>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-heading text-5xl font-semibold tracking-tight md:text-6xl">
              {FUND.name}
            </h1>
            <p className="text-muted-foreground mt-3 text-sm">
              {FUND.vehicle}
              <span className="mx-2 opacity-40">·</span>
              As of {FUND.asOf}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <FeedSource>Desk sample</FeedSource>
            <p className="text-muted-foreground max-w-xs text-sm leading-relaxed md:text-right">
              Sample partner book below. Your real blotter (after costs) sits under the title.
            </p>
          </div>
        </div>
      </header>

      <LiveBookStrip />

      <section className="animate-in fade-in slide-in-from-bottom-3 border-border grid grid-cols-2 gap-x-6 gap-y-8 border-y py-8 duration-700 delay-100 md:grid-cols-4 xl:grid-cols-8">
        <Stat label="AUM" value={formatUsd(FUND.aum)} />
        <Stat label="NAV" value={FUND.nav.toFixed(2)} />
        <Stat label="MTD" value={formatPct(FUND.mtd)} tone={FUND.mtd} />
        <Stat label="YTD" value={formatPct(FUND.ytd)} tone={FUND.ytd} />
        <Stat label="ITD" value={formatPct(FUND.itd)} tone={FUND.itd} />
        <Stat label="Sharpe*" value={FUND.sharpe.toFixed(2)} />
        <Stat label="Vol" value={`${(FUND.vol * 100).toFixed(1)}%`} />
        <Stat label="Max DD" value={formatPct(FUND.maxDd)} tone={FUND.maxDd} />
      </section>
      <p className="text-muted-foreground -mt-8 text-xs">
        *Sample Sharpe on the illustrative book, not a live statistic. Real numbers are in Your blotter.
      </p>

      <section className="animate-in fade-in slide-in-from-bottom-4 grid gap-12 duration-700 delay-150 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)] lg:gap-16">
        <div>
          <SectionLabel>Net asset value</SectionLabel>
          <EquityChart points={NAV_SERIES} />
        </div>

        <div>
          <SectionLabel>
            Exposure · Gross {formatPct(FUND.gross)} · Net {formatPct(FUND.net)}
          </SectionLabel>
          <div className="space-y-6">
            {SLEEVES.map((sleeve) => (
              <div key={sleeve.label} className="space-y-2">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-foreground/90">{sleeve.label}</span>
                  <span className="font-mono tabular-nums">{formatPct(sleeve.weight)}</span>
                </div>
                <div className="bg-muted h-px overflow-hidden">
                  <div
                    className="bg-primary h-full"
                    style={{ width: `${sleeve.weight * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <dl className="border-border mt-8 grid grid-cols-2 gap-6 border-t pt-6">
              {RISK_NOTES.map((row) => (
                <div key={row.label}>
                  <dt className="text-muted-foreground text-[10px] tracking-[0.18em] uppercase">
                    {row.label}
                  </dt>
                  <dd className="mt-1.5 font-mono text-sm tabular-nums">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="animate-in fade-in slide-in-from-bottom-5 duration-700 delay-200">
        <SectionLabel>Positions</SectionLabel>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-border border-b text-left text-[10px] tracking-[0.18em] uppercase">
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Side</th>
              <th className="hidden pb-3 font-medium sm:table-cell">Sector</th>
              <th className="pb-3 text-right font-medium">Weight</th>
              <th className="pb-3 text-right font-medium">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {POSITIONS.map((row) => (
              <tr key={row.symbol} className="border-border/60 border-b last:border-0">
                <td className="py-3.5 pr-3">
                  <span className="font-mono text-xs tracking-wide">{row.symbol}</span>
                  <span className="text-muted-foreground ml-3 hidden md:inline">{row.name}</span>
                </td>
                <td className="py-3.5 pr-3 text-foreground/80">{row.side}</td>
                <td className="text-muted-foreground hidden py-3.5 pr-3 sm:table-cell">
                  {row.sector}
                </td>
                <td className="py-3.5 text-right font-mono tabular-nums">
                  {formatPct(row.weight)}
                </td>
                <td className={`py-3.5 pl-3 text-right font-mono tabular-nums ${pnlClass(row.pnl)}`}>
                  {formatPct(row.pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
