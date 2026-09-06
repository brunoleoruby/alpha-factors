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
  const tv = tradingViewSymbol(symbol, locale);
  const src = useMemo(() => {
    const settings = {
      autosize: true,
      symbol: tv,
      interval: "D",
      timezone: "exchange",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "#0d0d0c",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
    };
    // Hash config is how the official widget passes NSE:TICKER. Do not use
    // URL.hash assignment — it can double-encode and break Indian symbols.
    return `https://www.tradingview.com/embed-widget/advanced-chart/?locale=en#${encodeURIComponent(JSON.stringify(settings))}`;
  }, [tv]);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-primary/15 bg-[#0d0d0c]", className)}>
      <iframe
        key={src}
        title={`TradingView ${name ?? tv}`}
        src={src}
        className={cn("w-full", heightClassName)}
        style={{ border: 0 }}
        allow="clipboard-write; fullscreen"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
