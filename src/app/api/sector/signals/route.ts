import { NextRequest, NextResponse } from "next/server";
import { computeLiveSignals } from "@/lib/markets/compute-live-signals";
import type { SectorMarket } from "@/lib/markets/sector-returns";

export async function GET(req: NextRequest) {
  try {
    const market = (req.nextUrl.searchParams.get("market") === "US" ? "US" : "NSE") as SectorMarket;
    const book = await computeLiveSignals(market);
    return NextResponse.json(book);
  } catch {
    return NextResponse.json({ error: "Sector feed down" }, { status: 502 });
  }
}
