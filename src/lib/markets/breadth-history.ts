import { promises as fs } from "fs";
import path from "path";
import { mergeBreadthRows, parseBreadthDays } from "@/lib/markets/breadth-days";
import type { BreadthDay } from "@/lib/markets/nse-breadth";

const FILE = path.join(process.cwd(), "data", "market-breadth-history.json");

export function istToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function readBreadthHistory(): Promise<BreadthDay[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return parseBreadthDays(JSON.parse(raw) as unknown);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    return [];
  }
}

export async function writeBreadthHistory(rows: BreadthDay[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const next = mergeBreadthRows(rows);
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify({ rows: next }, null, 2)}\n`, "utf8");
  try {
    await fs.unlink(FILE);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  await fs.rename(tmp, FILE);
}

export async function mergeBreadthDay(row: BreadthDay | null): Promise<BreadthDay[]> {
  const next = mergeBreadthRows(await readBreadthHistory(), row ? [row] : []);
  try {
    await writeBreadthHistory(next);
  } catch {
    return next;
  }
  return next;
}

export function liveBreadthDay(
  thrust: { up45: number; down45: number; up5d20: number; down5d20: number } | null,
  ma: {
    dma20: { above: number; below: number } | null;
    dma50: { above: number; below: number } | null;
    dma200: { above: number; below: number } | null;
  },
): BreadthDay | null {
  if (!thrust && !ma.dma20 && !ma.dma50 && !ma.dma200) return null;
  return {
    date: istToday(),
    up45: thrust?.up45 ?? 0,
    down45: thrust?.down45 ?? 0,
    up5d20: thrust?.up5d20 ?? 0,
    down5d20: thrust?.down5d20 ?? 0,
    above20: ma.dma20?.above ?? 0,
    below20: ma.dma20?.below ?? 0,
    above50: ma.dma50?.above ?? 0,
    below50: ma.dma50?.below ?? 0,
    above200: ma.dma200?.above ?? 0,
    below200: ma.dma200?.below ?? 0,
  };
}
