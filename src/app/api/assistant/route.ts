import { NextRequest, NextResponse } from "next/server";
import { runDeskAgent, type JournalSnapshot } from "@/lib/assistant/run";
import type { SectorMarket } from "@/lib/markets/sector-returns";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      message?: string;
      market?: SectorMarket;
      journal?: JournalSnapshot;
    };
    const message = (body.message ?? "").trim();
    if (!message) return NextResponse.json({ error: "Empty question" }, { status: 400 });
    const result = await runDeskAgent({
      message,
      market: body.market === "US" ? "US" : "NSE",
      journal: body.journal,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Assistant down" }, { status: 502 });
  }
}
