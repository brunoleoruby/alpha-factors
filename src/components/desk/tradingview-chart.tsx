"use client";

import { useMemo } from "react";
import { cn } from "cn";
import type { ExchangeId } from "@/lib/markets/types";
import { tradingViewSymbol } from "@/lib/markets/tv";

export function TradingViewChart({
  symbol,
  locale,
  name,
  className,
  heightClassName = "h-[420px] md:h-[560px]",
}: {
  symbol: string;
  locale: ExchangeId;
  name?: string;
  className?: string;
  heightClassName?: string;
}) {
  const src = useMemo(() => {
    const tv = tradingViewSymbol(symbol, locale);
    const url = new URL("https://s.tradingview.com/widgetembed/");
    url.searchParams.set("symbol", tv);
    url.searchParams.set("interval", "D");
    url.searchParams.set("hidesidetoolbar", "0");
    url.searchParams.set("hidetopsheets", "1");
    url.searchParams.set("symboledit", "0");
    url.searchParams.set("saveimage", "1");
    url.searchParams.set("toolbarbg", "0d0d0c");
    url.searchParams.set("studies", "[]");
    url.searchParams.set("theme", "dark");
    url.searchParams.set("style", "1");
    url.searchParams.set("timezone", locale === "NSE" ? "Asia/Kolkata" : "America/New_York");
    url.searchParams.set("withdateranges", "1");
    url.searchParams.set("hideideas", "1");
    url.searchParams.set("locale", "en");
    url.searchParams.set("details", "1");
    url.searchParams.set("calendar", "0");
    url.searchParams.set("hotlist", "0");
    url.searchParams.set("allow_symbol_change", "0");
    url.searchParams.set("hidevolume", "0");
    return url.toString();
  }, [locale, symbol]);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-primary/15 bg-[#0d0d0c]", className)}>
      <iframe
        key={src}
        title={`TradingView ${name ?? symbol}`}
        src={src}
        className={cn("w-full", heightClassName)}
        style={{ border: 0 }}
        allow="clipboard-write; fullscreen"
        loading="lazy"
        referrerPolicy="origin-when-cross-origin"
      />
    </div>
  );
}
