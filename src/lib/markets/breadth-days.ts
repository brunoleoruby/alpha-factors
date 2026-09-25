import type { BreadthDay } from "@/lib/markets/nse-breadth";

export const BREADTH_LOCAL_KEY = "alpha-factors.market-breadth.v1";
export const BREADTH_KEEP = 180;

const FIELDS: (keyof BreadthDay)[] = [
  "up45",
  "down45",
  "up5d20",
  "down5d20",
  "above20",
  "below20",
  "above50",
  "below50",
  "above200",
  "below200",
];

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function parseBreadthDays(raw: unknown): BreadthDay[] {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { rows?: unknown }).rows)
      ? (raw as { rows: unknown[] }).rows
      : [];
  const out: BreadthDay[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
    out.push({
      date: row.date,
      up45: num(row.up45),
      down45: num(row.down45),
      up5d20: num(row.up5d20),
      down5d20: num(row.down5d20),
      above20: num(row.above20),
      below20: num(row.below20),
      above50: num(row.above50),
      below50: num(row.below50),
      above200: num(row.above200),
      below200: num(row.below200),
    });
  }
  return out;
}

function fill(row: BreadthDay) {
  return FIELDS.reduce((sum, key) => sum + Number(row[key]), 0);
}

export function mergeBreadthRows(...lists: BreadthDay[][]): BreadthDay[] {
  const byDate = new Map<string, BreadthDay>();
  for (const list of lists) {
    for (const row of list) {
      const prev = byDate.get(row.date);
      if (!prev || fill(row) >= fill(prev)) byDate.set(row.date, row);
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, BREADTH_KEEP);
}

export function loadLocalBreadth(): BreadthDay[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BREADTH_LOCAL_KEY);
    if (!raw) return [];
    return parseBreadthDays(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveLocalBreadth(rows: BreadthDay[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BREADTH_LOCAL_KEY, JSON.stringify({ rows }));
}
