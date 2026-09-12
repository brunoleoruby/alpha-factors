import { AllStocksTable } from "@/components/desk/all-stocks-table";
import { NseSubnav } from "@/components/desk/exchange-nav";
import { NIFTY50_LISTINGS } from "@/lib/markets/nse";

export default function NseStocksPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-8 md:px-6">
      <NseSubnav />
      <header className="mx-auto mt-2 w-full max-w-[1600px]">
        <p className="text-primary text-xs font-medium tracking-[0.22em] uppercase">NSE · cash equity</p>
        <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          Nifty 50
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          The 50 Nifty cash names on this desk. Open a symbol for its TradingView chart, or search
          the book then switch to Pattern desk to paste a headline.
        </p>
      </header>
      <AllStocksTable listings={NIFTY50_LISTINGS} locale="NSE" title="Nifty 50" />
    </div>
  );
}
