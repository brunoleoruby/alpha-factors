import { NextResponse } from "next/server";
import { mergeBreadthRows, parseBreadthDays } from "@/lib/markets/breadth-days";
import { readBreadthHistory, writeBreadthHistory } from "@/lib/markets/breadth-history";
import { fetchNseBreadth } from "@/lib/markets/nse-breadth";

export async function GET() {
  try {
    const body = await fetchNseBreadth();
    if (body.error && !body.exchange && !body.indices.length && !body.history.length) {
      return NextResponse.json(body, { status: 502 });
    }
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "NSE breadth down" }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const incoming = parseBreadthDays(body);
    const history = mergeBreadthRows(await readBreadthHistory(), incoming);
    await writeBreadthHistory(history);
    return NextResponse.json({ ok: true, history });
  } catch {
    return NextResponse.json({ error: "Could not save market breadth" }, { status: 500 });
  }
}
