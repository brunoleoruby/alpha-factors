import Link from "next/link";
import { TradingViewChart } from "@/components/desk/tradingview-chart";
import type { ExchangeId, Listing } from "@/lib/markets/types";
import { tradingViewSymbol } from "@/lib/markets/tv";

export function StockChartView({
  listing,
  locale,
  backHref,
  deskHref,
}: {
  listing: Listing;
  locale: ExchangeId;
  backHref: string;
  deskHref: string;
}) {
  const tv = tradingViewSymbol(listing.symbol, locale);
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 pb-8 md:px-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-primary text-xs font-medium tracking-[0.22em] uppercase">
            {locale} · TradingView
          </p>
          <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            {listing.symbol}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {listing.name} · {listing.sector} · {tv}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={backHref} className="border-primary/25 hover:border-primary/50 rounded-full border px-3 py-1">
            All stocks
          </Link>
          <Link href={deskHref} className="border-primary/25 hover:border-primary/50 rounded-full border px-3 py-1">
            Pattern desk
          </Link>
        </div>
      </header>
      <TradingViewChart
        symbol={listing.symbol}
        locale={locale}
        name={listing.name}
        heightClassName="h-[520px] md:h-[680px]"
      />
      <p className="text-muted-foreground text-xs">
        {locale === "NSE" ? (
          <>
            NSE cash names are blocked on TradingView&apos;s public embed. Charts here use
            TradingView Lightweight Charts with a Swings tool (dots on highs and lows) on every timeframe.{" "}
          </>
        ) : (
          <>Live candles with swing high / low marks on each timeframe. </>
        )}
        <a
          href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tv)}`}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          Open {tv} on TradingView
        </a>
      </p>
    </div>
  );
}
