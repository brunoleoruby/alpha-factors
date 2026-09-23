import { NextRequest, NextResponse } from "next/server";
import { defenceTf, fetchThemeIndexOhlc, themeIndustry } from "@/lib/markets/defence-index-ohlc";

export async function GET(req: NextRequest) {
  const industry = themeIndustry(req.nextUrl.searchParams.get("id"));
  try {
    return NextResponse.json(await fetchThemeIndexOhlc(industry, defenceTf(req.nextUrl.searchParams.get("tf"))));
  } catch {
    return NextResponse.json({ error: `${industry} index candles down` }, { status: 502 });
  }
}
