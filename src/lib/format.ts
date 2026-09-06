const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdFine = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const pct = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const formatUsd = (n: number) => usd.format(n);
export const formatUsdFine = (n: number) => usdFine.format(n);
export const formatPct = (n: number) => pct.format(n);
export const formatNum = (n: number) => num.format(n);
export const formatSigned = (n: number) => `${n > 0 ? "+" : ""}${num.format(n)}`;

export function pnlClass(n: number) {
  if (n > 0.0001) return "text-gain";
  if (n < -0.0001) return "text-loss";
  return "text-muted-foreground";
}
