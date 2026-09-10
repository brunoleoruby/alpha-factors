import { NextResponse } from "next/server";
import { readTradeFile, writeTradeFile } from "@/lib/portfolio/store";
import { parseTradeList } from "@/lib/portfolio/trades";

export async function GET() {
  try {
    const trades = await readTradeFile();
    return NextResponse.json({ trades });
  } catch {
    return NextResponse.json({ error: "Could not read trade book" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const trades = parseTradeList(
      body && typeof body === "object" && "trades" in body
        ? (body as { trades: unknown }).trades
        : body,
    );
    await writeTradeFile(trades);
    return NextResponse.json({ ok: true, count: trades.length });
  } catch {
    return NextResponse.json({ error: "Could not save trade book" }, { status: 500 });
  }
}
