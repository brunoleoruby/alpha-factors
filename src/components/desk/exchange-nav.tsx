"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const links = [
  { href: "/", label: "US" },
  { href: "/nse", label: "NSE" },
];

export function ExchangeNav() {
  const path = usePathname();
  return (
    <div className="border-primary/20 bg-card/60 flex items-center gap-1 border-b px-4 py-2 md:px-6">
      <span className="text-muted-foreground mr-3 hidden text-[10px] tracking-[0.18em] uppercase sm:inline">
        Exchange
      </span>
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
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
      {path.startsWith("/nse") ? (
        <Link
          href="/nse/stocks"
          className={cn(
            "ml-2 rounded-md px-3 py-1 text-sm",
            path === "/nse/stocks"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          All stocks
        </Link>
      ) : null}
    </div>
  );
}

export function NseSubnav() {
  const path = usePathname();
  const items = [
    { href: "/nse", label: "Pattern desk" },
    { href: "/nse/stocks", label: "All stocks" },
  ];
  return (
    <div className="flex gap-2 px-4 pt-4 md:px-6">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-full border px-3 py-1 text-xs tracking-wide uppercase",
            path === item.href
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
