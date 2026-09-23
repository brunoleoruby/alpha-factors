import { NextRequest, NextResponse } from "next/server";
import { defenceTf, fetchDefenceIndexOhlc } from "@/lib/markets/defence-index-ohlc";

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await fetchDefenceIndexOhlc(defenceTf(req.nextUrl.searchParams.get("tf"))));
  } catch {
    return NextResponse.json({ error: "Defence index candles down" }, { status: 502 });
  }
}
