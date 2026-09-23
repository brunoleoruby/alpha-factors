import * as XLSX from "xlsx";
import {
  type Trade,
  inferAccount,
  inferSegment,
} from "./trades";

export type ImportReport = {
  trades: Trade[];
  file: string;
  sheets: string[];
  added: number;
  skipped: number;
  warnings: string[];
};

const DATE_KEYS = ["date", "trade date", "trdate", "fill date", "tradetime", "trade datetime"];
const SYMBOL_KEYS = [
  "symbol",
  "tradingsymbol",
  "trading symbol",
  "ticker",
  "scrip",
  "scrip name",
  "instrument",
  "option",
  "contract",
];
const SIDE_KEYS = ["side", "trade type", "transaction", "buy/sell", "type", "bs"];
const QTY_KEYS = ["qty", "quantity", "traded qty", "filled qty", "lots"];
const PRICE_KEYS = ["price", "avg price", "average price", "trade price", "avg. price", "ltp", "entry"];
const ACCOUNT_KEYS = ["account", "client id", "clientid", "uccid", "user"];
const SEGMENT_KEYS = ["segment"];
const NOTES_KEYS = ["notes", "remarks", "remark", "comment", "edge"];
const ISIN_KEYS = ["isin"];
const EXCHANGE_KEYS = ["exchange", "exch"];
const SERIES_KEYS = ["series"];
const AUCTION_KEYS = ["auction"];
const TRADE_ID_KEYS = ["trade id", "tradeid", "fill id"];
const ORDER_ID_KEYS = ["order id", "orderid"];
const EXEC_KEYS = ["order execution time", "execution time", "trade time", "timestamp"];

function norm(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function looksLikeHeader(cells: unknown[]) {
  const keys = cells.map(norm);
  const hasDate = keys.some((k) => DATE_KEYS.includes(k));
  const hasSym = keys.some((k) => SYMBOL_KEYS.includes(k));
  const hasQty = keys.some((k) => QTY_KEYS.includes(k));
  return hasDate && hasSym && hasQty;
}

function pick(row: Record<string, unknown>, aliases: string[]) {
  for (const key of Object.keys(row)) {
    if (aliases.includes(norm(key))) return row[key];
  }
  return undefined;
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const mm = String(parsed.m).padStart(2, "0");
    const dd = String(parsed.d).padStart(2, "0");
    return `${parsed.y}-${mm}-${dd}`;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    if (m > 12 && d <= 12) {
      return `${y}-${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}`;
    }
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const named = Date.parse(raw);
  if (!Number.isNaN(named)) return new Date(named).toISOString().slice(0, 10);
  return null;
}

function parseSide(value: unknown): "Buy" | "Sell" | null {
  const v = norm(value);
  if (["buy", "b", "long", "bl", "bought"].includes(v)) return "Buy";
  if (["sell", "s", "short", "sl", "sold"].includes(v)) return "Sell";
  return null;
}

function parseAccount(value: unknown, hint: string) {
  return inferAccount(value, hint);
}

function parseSegment(value: unknown, sheet: string, hint: string) {
  return inferSegment(value, sheet, hint);
}

function parseExecutedAt(value: unknown, date: string) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const raw = String(value ?? "").trim();
  if (!raw) return date ? `${date}T00:00:00` : "";
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw;
  return raw;
}

function scanClientId(rows: unknown[][]) {
  for (const row of rows.slice(0, 20)) {
    const line = row ?? [];
    if (norm(line[0]) === "client id") return String(line[1] ?? "").trim();
  }
  return "";
}

function hashId(parts: string) {
  let h = 2166136261;
  for (let i = 0; i < parts.length; i++) {
    h ^= parts.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `file-${(h >>> 0).toString(16)}`;
}

function objectsFromSheet(sheet: XLSX.WorkSheet) {
  const rows = XLSX.utils.sheet_to_json<(unknown | undefined)[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });
  const clientId = scanClientId(rows as unknown[][]);
  let headerAt = 0;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    if (looksLikeHeader(rows[i] ?? [])) {
      headerAt = i;
      break;
    }
  }
  const headers = (rows[headerAt] ?? []).map((h, i) => String(h ?? "").trim() || `col${i}`);
  const objects: Record<string, unknown>[] = [];
  for (let r = headerAt + 1; r < rows.length; r++) {
    const line = rows[r] ?? [];
    if (line.every((c) => String(c ?? "").trim() === "")) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      obj[h] = line[i];
    });
    objects.push(obj);
  }
  return { objects, clientId };
}

export function parseWorkbook(buffer: ArrayBuffer | Buffer, fileName: string): {
  trades: Trade[];
  sheets: string[];
  skipped: number;
  warnings: string[];
} {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const trades: Trade[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  const seen = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const { objects, clientId } = objectsFromSheet(sheet);
    for (const row of objects) {
      const date = parseDate(pick(row, DATE_KEYS));
      const symbol = String(pick(row, SYMBOL_KEYS) ?? "")
        .trim()
        .toUpperCase();
      const side = parseSide(pick(row, SIDE_KEYS));
      const qty = Number(pick(row, QTY_KEYS));
      const price = Number(pick(row, PRICE_KEYS));
      if (!date || !symbol || !side || !(qty > 0) || !(price > 0)) {
        skipped += 1;
        continue;
      }
      const tradeId = String(pick(row, TRADE_ID_KEYS) ?? "").trim();
      const orderId = String(pick(row, ORDER_ID_KEYS) ?? "").trim();
      const account = parseAccount(pick(row, ACCOUNT_KEYS) ?? clientId, fileName);
      const venueSegment = String(pick(row, SEGMENT_KEYS) ?? "").trim().toUpperCase();
      const segment = parseSegment(venueSegment || pick(row, SEGMENT_KEYS), sheetName, fileName);
      const notes = String(pick(row, NOTES_KEYS) ?? "").trim();
      const key = tradeId || `${date}|${symbol}|${side}|${qty}|${price}|${account}|${orderId}`;
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      trades.push({
        id: tradeId ? `zd-${tradeId}` : hashId(key),
        date,
        symbol,
        isin: String(pick(row, ISIN_KEYS) ?? "").trim(),
        exchange: String(pick(row, EXCHANGE_KEYS) ?? "").trim().toUpperCase(),
        series: String(pick(row, SERIES_KEYS) ?? "").trim().toUpperCase(),
        venueSegment,
        side,
        auction: ["true", "1", "yes"].includes(norm(pick(row, AUCTION_KEYS))),
        qty,
        price,
        tradeId,
        orderId,
        executedAt: parseExecutedAt(pick(row, EXEC_KEYS), date),
        account,
        segment,
        notes,
        source: "file",
      });
    }
  }

  if (!trades.length) {
    warnings.push(
      "No fill rows found. Need columns for date, symbol (or option/scrip), buy/sell (or long/short), qty, and price.",
    );
  }
  return { trades, sheets: wb.SheetNames, skipped, warnings };
}

export function mergeImported(existing: Trade[], incoming: Trade[]): Trade[] {
  if (!incoming.length) return existing;
  const ids = new Set(incoming.map((t) => t.id));
  const keep = existing.filter((t) => !ids.has(t.id));
  return [...keep, ...incoming];
}
