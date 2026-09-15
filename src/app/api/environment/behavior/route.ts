import { NextRequest, NextResponse } from "next/server";
import { ENV_COLUMNS, envYahooAllowlist } from "@/lib/markets/environment";
import { recognizeTape } from "@/lib/markets/tape-behavior";
import { isGiftYahoo } from "@/lib/markets/gift-nifty";
import { fetchDailyCandles } from "@/lib/markets/yahoo-daily";

function findInstrument(id: string) {
  for (const col of ENV_COLUMNS) {
    const row = col.rows.find((r) => r.id === id);
    if (row) return { column: col, instrument: row };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  const found = findInstrument(id);
  if (!found) {
    return NextResponse.json({ error: "Unknown ticker" }, { status: 404 });
  }
  if (isGiftYahoo(found.instrument.yahoo) || id === "giftnifty") {
    return NextResponse.json(
      { error: "GIFT Nifty is an Asia-session / open-cue print versus Nifty 50 previous close — not a cash-index rhyme." },
      { status: 422 },
    );
  }
  if (!envYahooAllowlist().has(found.instrument.yahoo)) {
    return NextResponse.json({ error: "Unknown ticker" }, { status: 404 });
  }

  try {
    const candles = await fetchDailyCandles(found.instrument.yahoo);
    const behavior = recognizeTape(candles);
    if (!behavior) {
      return NextResponse.json({ error: "Not enough history to rhyme this tape" }, { status: 422 });
    }
    return NextResponse.json({
      id: found.instrument.id,
      name: found.instrument.name,
      short: found.instrument.short,
      yahoo: found.instrument.yahoo,
      column: found.column.title,
      last: candles.at(-1)?.close ?? null,
      behavior,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Quote feed down" },
      { status: 502 },
    );
  }
}
