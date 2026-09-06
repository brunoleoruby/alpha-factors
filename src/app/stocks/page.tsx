import { AllStocksTable } from "@/components/desk/all-stocks-table";
import { UsSubnav } from "@/components/desk/exchange-nav";
import { US_LISTINGS } from "@/lib/markets/us";

export default function UsStocksPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-8 md:px-6">
      <UsSubnav />
      <header className="mx-auto mt-2 w-full max-w-[1600px]">
        <p className="text-primary text-xs font-medium tracking-[0.22em] uppercase">US · listed names</p>
        <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          All stocks
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Every US name on this desk. Open a row for the TradingView chart.
        </p>
      </header>
      <AllStocksTable listings={US_LISTINGS} locale="US" />
    </div>
  );
}
