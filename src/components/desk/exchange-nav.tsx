"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { HeaderSaveButton } from "@/components/desk/header-save";
import { DeskAssistant } from "@/components/desk/desk-assistant";
import { PaletteSwitch } from "@/components/desk/palette-switch";
import { FeedSource } from "@/components/desk/feed-source";
import { BrandLogo } from "@/components/desk/brand-logo";

function isEnvironment(path: string) {
  return path.startsWith("/environment") || path.startsWith("/nse/environment");
}

function isPortfolio(path: string) {
  return path.startsWith("/portfolio");
}

function isTimeframe(path: string) {
  return path.startsWith("/timeframe");
}

function isSector(path: string) {
  return path.startsWith("/sector");
}

function isIpo(path: string) {
  return path.startsWith("/ipo");
}

function isAlgorithm(path: string) {
  return path.startsWith("/algorithm");
}

function isGlobalTab(path: string) {
  return (
    isEnvironment(path) ||
    isPortfolio(path) ||
    isTimeframe(path) ||
    isSector(path) ||
    isIpo(path) ||
    isAlgorithm(path)
  );
}

const links = [
  {
    href: "/",
    label: "US",
    match: (path: string) => !path.startsWith("/nse") && !isGlobalTab(path),
  },
  {
    href: "/nse",
    label: "NSE",
    match: (path: string) => path.startsWith("/nse") && !isGlobalTab(path),
  },
];

export function ExchangeNav() {
  const path = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const envActive = isEnvironment(path);
  const portfolioActive = isPortfolio(path);
  const timeframeActive = isTimeframe(path);
  const sectorActive = isSector(path);
  const ipoActive = isIpo(path);
  const algorithmActive = isAlgorithm(path);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const sync = () => {
      document.documentElement.style.setProperty("--desk-nav-h", `${el.offsetHeight}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={navRef}
      className="border-border/80 bg-background/90 sticky top-0 z-50 flex flex-wrap items-center gap-1 border-b px-4 py-3 backdrop-blur-md md:px-8"
    >
      <Link href="/" className="mr-5 shrink-0" aria-label="Eminent Corpus">
        <BrandLogo />
      </Link>
      {links.map((l) => {
        const active = l.match(path);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-md px-3 py-1 text-sm",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {l.label}
          </Link>
        );
      })}
      <Link
        href="/environment"
        className={cn(
          "rounded-md px-3 py-1 text-sm",
          envActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
        )}
      >
        Market environment
      </Link>
      <Link
        href="/portfolio"
        className={cn(
          "rounded-md px-3 py-1 text-sm",
          portfolioActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
        )}
      >
        Portfolio
      </Link>
      <Link
        href="/timeframe"
        className={cn(
          "rounded-md px-3 py-1 text-sm",
          timeframeActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
        )}
      >
        Time frame
      </Link>
      <Link
        href="/sector"
        className={cn(
          "rounded-md px-3 py-1 text-sm",
          sectorActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
        )}
      >
        Sector analysis
      </Link>
      <Link
        href="/ipo"
        className={cn(
          "rounded-md px-3 py-1 text-sm",
          ipoActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
        )}
      >
        IPO
      </Link>
      <Link
        href="/algorithm"
        className={cn(
          "rounded-md px-3 py-1 text-sm",
          algorithmActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
        )}
      >
        Algorithm
      </Link>
      <div className="ml-auto flex items-center gap-1">
        <PaletteSwitch />
        <HeaderSaveButton />
        <DeskAssistant />
      </div>
    </div>
  );
}

function PillNav({
  items,
}: {
  items: { href: string; label: string; active: (path: string) => boolean; source?: string }[];
}) {
  const path = usePathname();
  const current = items.find((item) => item.active(path));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-5 md:px-8">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
              item.active(path)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-primary/25 text-muted-foreground hover:border-primary/50",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {current?.source ? <FeedSource className="ml-auto">{current.source}</FeedSource> : null}
    </div>
  );
}

export function NseSubnav() {
  return (
    <PillNav
      items={[
        { href: "/nse", label: "Pattern desk", source: "TradingView", active: (p) => p === "/nse" },
        {
          href: "/nse/stocks",
          label: "Nifty 50",
          source: "Desk book · TradingView",
          active: (p) => p.startsWith("/nse/stocks"),
        },
        { href: "/nse/cases/polycab", label: "Polycab case", source: "Desk reference", active: (p) => p.startsWith("/nse/cases/polycab") },
        { href: "/nse/cases/insider", label: "Insider trading", source: "Desk reference", active: (p) => p.startsWith("/nse/cases/insider") },
        {
          href: "/nse/cases/tape-events",
          label: "Pledge · QIP · USFDA",
          source: "Desk reference",
          active: (p) => p.startsWith("/nse/cases/tape-events"),
        },
      ]}
    />
  );
}

export function UsSubnav() {
  return (
    <PillNav
      items={[
        { href: "/", label: "Dashboard", source: "Desk sample", active: (p) => p === "/" },
        { href: "/desk", label: "Pattern desk", source: "TradingView", active: (p) => p.startsWith("/desk") },
        { href: "/stocks", label: "Top 50", source: "Desk book · TradingView", active: (p) => p.startsWith("/stocks") },
      ]}
    />
  );
}
