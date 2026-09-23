import * as XLSX from "xlsx";
import {
  inferBookSide,
  mergeFilePositions,
  positionId,
  type PnlSummary,
  type PositionLine,
} from "./positions";
import { type Trade, inferAccount, inferSegment } from "./trades";
import { parseWorkbook } from "./import-workbook";

export type ParsedImport =
  | {
      kind: "pnl";
      positions: PositionLine[];
      summary: PnlSummary | null;
      sheetSummaries: PnlSummary[];
      sheets: string[];
      skipped: number;
      warnings: string[];
      trades: Trade[];
    }
  | {
      kind: "tradebook";
      trades: Trade[];
      positions: PositionLine[];
      summary: null;
      sheets: string[];
      skipped: number;
      warnings: string[];
    };

function norm(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function num(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseAccount(value: unknown, hint: string) {
  return inferAccount(value, hint);
}

function parseSegment(value: unknown, sheet: string, hint: string) {
  return inferSegment(value, sheet, hint);
}

function scanClientId(rows: unknown[][]) {
  for (const row of rows.slice(0, 20)) {
    const line = row ?? [];
    if (norm(line[0]) === "client id") return String(line[1] ?? "").trim();
  }
  return "";
}

function looksLikePnlHeader(cells: unknown[]) {
  const keys = cells.map(norm);
  if (keys.includes("symbol") && keys.includes("buy value") && (keys.includes("sell value") || keys.includes("open quantity"))) {
    return true;
  }
  return looksLikeFyersPnlHeader(keys);
}

function looksLikeFyersPnlHeader(keys: string[]) {
  const hasSym = keys.includes("symbol name") || keys.includes("symbol code") || keys.includes("symbol");
  const hasPx = keys.includes("buy price") && keys.includes("sell price");
  const hasPnl = keys.includes("gross p&l") || keys.includes("realised p&l") || keys.includes("realized p&l");
  return hasSym && hasPx && hasPnl;
}

function workbookLooksLikePnl(wb: XLSX.WorkBook, fileName: string) {
  if (/\bpnl\b/i.test(fileName) || /\bp&l\b/i.test(fileName) || /realis[e]?d_p&l/i.test(fileName) || /(^|[_\-\s])pl([_\-\s.]|$)/i.test(fileName)) return true;
  if (/fyers/i.test(fileName) && /nifty|derivat|nfo|commod|mcx|\bfo\b/i.test(fileName)) return true;
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<(unknown | undefined)[]>(sheet, {
      header: 1,
      raw: true,
      defval: "",
    });
    if (rows.some((row) => looksLikePnlHeader(row ?? []))) return true;
    if (
      rows.some((row) =>
        String(row?.[0] ?? "")
          .toLowerCase()
          .includes("p&l statement") ||
        String(row?.[1] ?? "")
          .toLowerCase()
          .includes("realised p&l") ||
        String(row?.[1] ?? "")
          .toLowerCase()
          .includes("realized p&l"),
      )
    ) {
      return true;
    }
  }
  return false;
}

function pickIndex(header: string[], aliases: string[]) {
  const keys = header.map(norm);
  for (const alias of aliases) {
    const i = keys.indexOf(alias);
    if (i >= 0) return i;
  }
  return -1;
}

function cell(row: unknown[], index: number) {
  if (index < 0) return "";
  return row[index];
}

function isoDate(raw: string) {
  const iso = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return "";
}

function parseRange(rows: unknown[][]) {
  for (const row of rows.slice(0, 20)) {
    const title = `${row?.[0] ?? ""} ${row?.[1] ?? ""}`.trim();
    const iso = title.match(/from\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i);
    if (iso) return { from: iso[1], to: iso[2], title };
    const dmy = title.match(/from\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+to\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
    if (dmy) return { from: isoDate(dmy[1]), to: isoDate(dmy[2]), title };
  }
  return { from: "", to: "", title: "" };
}

function parseSummary(rows: unknown[][], until = 80) {
  let charges = 0;
  let otherCreditDebit = 0;
  let realizedPnl = 0;
  let unrealizedPnl = 0;
  const end = Math.min(rows.length, Math.max(until, 0));
  for (const row of rows.slice(0, end)) {
    const key = norm(row?.[0]);
    const raw = row?.[1];
    if (raw === "" || raw == null) continue;
    const value = num(raw);
    if (key === "charges" || key === "total charges" || key === "charges levied") charges = value;
    if (
      key === "other credit & debit" ||
      key === "other credit and debit" ||
      key === "other credits & debits" ||
      key === "other credits and debits"
    ) {
      otherCreditDebit = value;
    }
    if (key === "realized p&l" || key === "realised p&l" || key === "gross p&l") realizedPnl = value;
    if (key === "unrealized p&l") unrealizedPnl = value;
  }
  return { charges, otherCreditDebit, realizedPnl, unrealizedPnl };
}

function parsePnlSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  fileName: string,
): { positions: PositionLine[]; summary: PnlSummary | null; skipped: number } {
  const rows = XLSX.utils.sheet_to_json<(unknown | undefined)[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  }) as unknown[][];
  const clientId = scanClientId(rows);
  const account = parseAccount(clientId, fileName);
  const range = parseRange(rows);
  let headerAt = -1;
  for (let i = 0; i < rows.length; i++) {
    if (looksLikePnlHeader(rows[i] ?? [])) {
      headerAt = i;
      break;
    }
  }
  const totals = parseSummary(rows, headerAt >= 0 ? headerAt + 8 : 80);
  const segment = parseSegment(range.title, sheetName, fileName);
  if (headerAt < 0) return { positions: [], summary: null, skipped: 0 };

  const header = (rows[headerAt] ?? []).map((h) => String(h ?? "").trim());
  const fyers = looksLikeFyersPnlHeader(header.map(norm));
  const iSymbol = fyers
    ? pickIndex(header, ["symbol name", "symbol code", "symbol"])
    : pickIndex(header, ["symbol"]);
  const iIsin = pickIndex(header, ["isin"]);
  const iQty = pickIndex(header, ["qty", "quantity"]);
  const iBuyQty = pickIndex(header, ["buy qty", "buy quantity"]);
  const iSellQty = pickIndex(header, ["sell qty", "sell quantity"]);
  const iBuy = pickIndex(header, ["buy value"]);
  const iSell = pickIndex(header, ["sell value"]);
  const iBuyPx = pickIndex(header, ["buy price"]);
  const iSellPx = pickIndex(header, ["sell price"]);
  const iRpnl = pickIndex(header, ["realized p&l", "realised p&l", "gross p&l"]);
  const iRpct = pickIndex(header, ["realized p&l pct.", "realized p&l pct", "realized p&l %"]);
  const iPrev = pickIndex(header, ["previous closing price"]);
  const iOpenQty = pickIndex(header, ["open quantity"]);
  const iOpenType = pickIndex(header, ["open quantity type"]);
  const iOpenVal = pickIndex(header, ["open value"]);
  const iUpnl = pickIndex(header, ["unrealized p&l"]);
  const iUpct = pickIndex(header, ["unrealized p&l pct.", "unrealized p&l pct", "unrealized p&l %"]);
  const iSeg = pickIndex(header, ["segment"]);

  const positions: PositionLine[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  for (let r = headerAt + 1; r < rows.length; r++) {
    const line = rows[r] ?? [];
    if (line.every((c) => String(c ?? "").trim() === "")) continue;
    const symbol = String(cell(line, iSymbol) ?? "")
      .trim()
      .toUpperCase();
    if (!symbol || symbol === "SYMBOL" || symbol === "SYMBOL NAME" || symbol === "SYMBOL CODE") {
      skipped += 1;
      continue;
    }
    const quantity = num(cell(line, iQty)) || num(cell(line, iBuyQty)) || num(cell(line, iSellQty));
    const buyPrice = num(cell(line, iBuyPx));
    const sellPrice = num(cell(line, iSellPx));
    const buyValue = iBuy >= 0 ? num(cell(line, iBuy)) : quantity * buyPrice;
    const sellValue = iSell >= 0 ? num(cell(line, iSell)) : quantity * sellPrice;
    if (!(quantity || buyValue || sellValue || num(cell(line, iOpenQty)))) {
      skipped += 1;
      continue;
    }
    const openQty = num(cell(line, iOpenQty));
    const openQtyType = String(cell(line, iOpenType) ?? "").trim();
    const realizedPnl = num(cell(line, iRpnl));
    const sleeve = parseSegment(cell(line, iSeg), sheetName, `${fileName} ${symbol}`);
    const id = positionId(account, sleeve, symbol);
    if (seen.has(id)) {
      skipped += 1;
      continue;
    }
    seen.add(id);
    positions.push({
      id,
      symbol,
      isin: String(cell(line, iIsin) ?? "").trim(),
      from: range.from,
      to: range.to,
      buyDate: "",
      sellDate: "",
      quantity,
      buyValue,
      sellValue,
      buyPrice,
      sellPrice,
      riskAmount: 0,
      realizedPnl,
      realizedPnlPct: num(cell(line, iRpct)) || (buyValue ? realizedPnl / buyValue : 0),
      prevClose: num(cell(line, iPrev)),
      openQty,
      openQtyType,
      openValue: num(cell(line, iOpenVal)),
      unrealizedPnl: num(cell(line, iUpnl)),
      unrealizedPnlPct: num(cell(line, iUpct)),
      side: inferBookSide({ openQtyType, openQty }),
      account,
      segment: sleeve,
      source: "file",
      notes: fyers ? "Fyers realised P&L" : "",
    });
  }

  const summarySegment =
    positions.length && positions.every((row) => row.segment === positions[0].segment)
      ? positions[0].segment
      : segment;
  const summary: PnlSummary = {
    account,
    segment: summarySegment,
    from: range.from,
    to: range.to,
    charges: totals.charges,
    otherCreditDebit: totals.otherCreditDebit,
    realizedPnl: totals.realizedPnl,
    unrealizedPnl: totals.unrealizedPnl,
    file: fileName,
  };
  return { positions, summary, skipped };
}

export function parseImport(buffer: ArrayBuffer | Buffer, fileName: string): ParsedImport {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  if (workbookLooksLikePnl(wb, fileName)) {
    const positions: PositionLine[] = [];
    const sheetSummaries: PnlSummary[] = [];
    const warnings: string[] = [];
    let skipped = 0;
    let extraCharges = 0;
    let extraOther = 0;
    let summary: PnlSummary | null = null;
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<(unknown | undefined)[]>(sheet, {
        header: 1,
        raw: true,
        defval: "",
      }) as unknown[][];
      if (norm(sheetName).includes("debit") || norm(sheetName).includes("credit")) {
        const extra = parseSummary(rows, rows.length);
        extraCharges += extra.charges;
        extraOther += extra.otherCreditDebit;
        continue;
      }
      const parsed = parsePnlSheet(sheet, sheetName, fileName);
      skipped += parsed.skipped;
      if (parsed.summary && parsed.positions.length) {
        sheetSummaries.push(parsed.summary);
        summary = parsed.summary;
      }
      positions.push(...parsed.positions);
    }
    if (sheetSummaries.length && (extraCharges || extraOther)) {
      const first = sheetSummaries[0];
      sheetSummaries[0] = {
        ...first,
        charges: first.charges || extraCharges,
        otherCreditDebit: first.otherCreditDebit || extraOther,
      };
      summary = sheetSummaries[sheetSummaries.length - 1] ?? first;
    }
    if (!positions.length) {
      warnings.push(
        "No P&L rows found. Need Symbol, Quantity, Buy Value, Sell Value (Zerodha pnl-*.xlsx).",
      );
    }
    return {
      kind: "pnl",
      positions,
      summary,
      sheetSummaries,
      sheets: wb.SheetNames,
      skipped,
      warnings,
      trades: [],
    };
  }

  const trades = parseWorkbook(buffer, fileName);
  return {
    kind: "tradebook",
    trades: trades.trades,
    positions: [],
    summary: null,
    sheets: trades.sheets,
    skipped: trades.skipped,
    warnings: [
      ...trades.warnings,
      "This looks like a tradebook. Upload a Zerodha P&L file (pnl-TR8076.xlsx) for one row per stock.",
    ],
  };
}

export { mergeFilePositions };
