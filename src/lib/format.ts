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

function inrDigits(n: number, digits: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Math.abs(n));
}

export function formatInr(n: number) {
  return `${n < 0 ? "−" : ""}₹${inrDigits(n, 0)}`;
}

export function formatInrFine(n: number) {
  return `${n < 0 ? "−" : ""}₹${inrDigits(n, 2)}`;
}
export function formatInrCrore(crore: number) {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(crore)} cr`;
}

export function formatUsdCompact(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export const formatPct = (n: number) => pct.format(n);
export const formatNum = (n: number) => num.format(n);

/** Risk-reward as 1 : X (X can be negative on a loss). */
export function formatRr(ratio: number) {
  const body = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Math.abs(ratio));
  return `1 : ${ratio < 0 ? "−" : ""}${body}`;
}
export const formatSigned = (n: number) => `${n > 0 ? "+" : ""}${num.format(n)}`;

export function pnlClass(n: number) {
  if (n > 0.0001) return "text-gain";
  if (n < -0.0001) return "text-loss";
  return "text-muted-foreground";
}

/** Display dates as dd-mm-yyyy. Storage stays ISO (yyyy-mm-dd). */
export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const raw = value.trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[1].padStart(2, "0")}-${dmy[2].padStart(2, "0")}-${dmy[3]}`;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return raw;
  const d = new Date(t);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

export function formatDateShort(value: string) {
  const full = formatDate(value);
  const parts = full.split("-");
  return parts.length === 3 ? `${parts[0]}-${parts[1]}` : full;
}

/** Empty string if missing; otherwise dd-mm-yyyy for typing. */
export function toDayMonthYear(value: string | null | undefined) {
  if (!value?.trim()) return "";
  const shown = formatDate(value);
  return shown === "—" ? "" : shown;
}

/** Accepts dd-mm-yyyy, dd/mm/yyyy, or ISO. Returns yyyy-mm-dd or "". */
export function toIsoDate(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!dmy) return "";
  return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
}
