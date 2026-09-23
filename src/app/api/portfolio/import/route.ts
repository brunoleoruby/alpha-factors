import { NextResponse } from "next/server";
import { mergeImported } from "@/lib/portfolio/import-workbook";
import { parseImport } from "@/lib/portfolio/import-pnl";
import { mergeFilePositions, mergeSummaries } from "@/lib/portfolio/positions";
import { readPositionFile, readTradeFile, writePositionFile, writeTradeFile } from "@/lib/portfolio/store";
import { promises as fs } from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "data", "imports");
const ACCEPT = new Set([".xlsx", ".xls", ".csv"]);

export const runtime = "nodejs";

async function applyFile(filePath: string, originalName: string) {
  const buf = await fs.readFile(filePath);
  const parsed = parseImport(buf, originalName);
  if (parsed.kind === "pnl") {
    const current = await readPositionFile();
    const positions = mergeFilePositions(current.positions, parsed.positions);
    const incomingSummaries =
      parsed.sheetSummaries.length > 0
        ? parsed.sheetSummaries
        : parsed.summary
          ? [parsed.summary]
          : [];
    let summaries = current.summaries;
    for (const row of incomingSummaries) {
      const incomingRows = parsed.positions.filter(
        (pos) => pos.account === row.account && pos.segment === row.segment,
      );
      summaries = mergeSummaries(summaries, row, incomingRows, positions);
    }
    const book = { positions, summary: parsed.summary, summaries };
    await writePositionFile(book);
    return {
      ok: true,
      kind: "pnl" as const,
      file: originalName,
      sheets: parsed.sheets,
      added: parsed.positions.length,
      skipped: parsed.skipped,
      warnings: parsed.warnings,
      count: positions.length,
      positions,
      summary: parsed.summary,
      summaries,
    };
  }

  const currentTrades = await readTradeFile();
  const trades = mergeImported(currentTrades, parsed.trades);
  await writeTradeFile(trades);
  return {
    ok: true,
    kind: "tradebook" as const,
    file: originalName,
    sheets: parsed.sheets,
    added: parsed.trades.length,
    skipped: parsed.skipped,
    warnings: parsed.warnings,
    count: trades.length,
    trades,
    positions: [],
    summary: null,
    summaries: {},
  };
}

async function newestImport() {
  try {
    const names = await fs.readdir(DIR);
    const files = names.filter((n) => ACCEPT.has(path.extname(n).toLowerCase()));
    if (!files.length) return null;
    const ranked = await Promise.all(
      files.map(async (name) => {
        const full = path.join(DIR, name);
        const st = await fs.stat(full);
        return { name, full, mtime: st.mtimeMs };
      }),
    );
    ranked.sort((a, b) => {
      const score = (n: string) => (/\bpnl\b/i.test(n) || /(^|[_\-\s])pl([_\-\s.]|$)/i.test(n) ? 1 : 0);
      if (score(a.name) !== score(b.name)) return score(b.name) - score(a.name);
      return b.mtime - a.mtime;
    });
    return ranked[0];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function GET() {
  try {
    const hit = await newestImport();
    if (!hit) {
      return NextResponse.json({
        ok: false,
        error: "No Excel/CSV in data/imports. Drop a pnl-*.xlsx there or upload from Portfolio.",
      });
    }
    const body = await applyFile(hit.full, hit.name);
    return NextResponse.json({ ...body, autofetch: true, mtime: hit.mtime });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose an Excel or CSV file" }, { status: 400 });
    }
    const ext = path.extname(file.name).toLowerCase();
    if (!ACCEPT.has(ext)) {
      return NextResponse.json({ error: "Use .xlsx, .xls, or .csv" }, { status: 400 });
    }
    await fs.mkdir(DIR, { recursive: true });
    const safe = file.name.replace(/[^\w.\- ()]+/g, "_");
    const dest = path.join(DIR, safe);
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(dest, buf);
    const body = await applyFile(dest, safe);
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
