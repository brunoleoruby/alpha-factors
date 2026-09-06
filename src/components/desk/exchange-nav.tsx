"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const links = [
  { href: "/", label: "US", match: (path: string) => path === "/" || path.startsWith("/stocks") },
  { href: "/nse", label: "NSE", match: (path: string) => path.startsWith("/nse") },
];

export function ExchangeNav() {
  const path = usePathname();
  const onNse = path.startsWith("/nse");
  const allStocksHref = onNse ? "/nse/stocks" : "/stocks";
  const allStocksActive = onNse ? path.startsWith("/nse/stocks") : path.startsWith("/stocks");
  return (
    <div className="border-primary/20 bg-card/60 flex items-center gap-1 border-b px-4 py-2 md:px-6">
      <span className="text-muted-foreground mr-3 hidden text-[10px] tracking-[0.18em] uppercase sm:inline">
        Exchange
      </span>
      {links.map((l) => {
        const active = l.match(path);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {l.label}
          </Link>
        );
      })}
      <Link
        href={allStocksHref}
        className={cn(
          "ml-2 rounded-md px-3 py-1 text-sm",
          allStocksActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
        )}
      >
        All stocks
      </Link>
    </div>
  );
}

function PillNav({
  items,
}: {
  items: { href: string; label: string; active: (path: string) => boolean }[];
}) {
  const path = usePathname();
  return (
    <div className="flex gap-2 px-4 pt-4 md:px-6">
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
  );
}

export function NseSubnav() {
  return (
    <PillNav
      items={[
        { href: "/nse", label: "Pattern desk", active: (p) => p === "/nse" },
        { href: "/nse/stocks", label: "All stocks", active: (p) => p.startsWith("/nse/stocks") },
      ]}
    />
  );
}

export function UsSubnav() {
  return (
    <PillNav
      items={[
        { href: "/", label: "Pattern desk", active: (p) => p === "/" },
        { href: "/stocks", label: "All stocks", active: (p) => p.startsWith("/stocks") },
      ]}
    />
  );
}
