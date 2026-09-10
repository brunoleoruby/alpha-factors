import { promises as fs } from "fs";
import path from "path";
import { parseTradeList, type Trade } from "./trades";

const FILE = path.join(process.cwd(), "data", "trades.json");

export function tradeFilePath() {
  return FILE;
}

export async function readTradeFile(): Promise<Trade[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return parseTradeList(JSON.parse(raw) as unknown);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function writeTradeFile(trades: Trade[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(trades, null, 2)}\n`, "utf8");
  await fs.rename(tmp, FILE);
}
