import { NseSubnav } from "@/components/desk/exchange-nav";
import { NewsDesk } from "@/components/desk/news-desk";
import { NSE_LISTINGS } from "@/lib/markets/nse";
import { DEFAULT_STRATEGY_NSE } from "@/lib/news/taxonomy";

export default function NseDeskPage() {
  return (
    <>
      <NseSubnav />
      <NewsDesk
        locale="NSE"
        listings={NSE_LISTINGS}
        defaultPaste="Reliance Industries cuts guidance on softer petchem trends"
        defaultSymbol="RELIANCE"
        settingsKey="news-pattern-desk-nse"
        defaultConfig={DEFAULT_STRATEGY_NSE}
        title="NSE News Pattern Desk"
        eyebrow="National Stock Exchange of India"
      />
    </>
  );
}
