import { NextResponse } from "next/server";
import { ENV_COLUMNS, envYahooAllowlist } from "@/lib/markets/environment";
import { ENV_SHARE_IDS, type EnvShareChance } from "@/lib/markets/share-ids";
import { recognizeTape } from "@/lib/markets/tape-behavior";
import { fetchGiftNiftyQuote } from "@/lib/markets/gift-nifty";
import { fetchDailyCandles } from "@/lib/markets/yahoo-daily";

function findInstrument(id: string) {
  for (const col of ENV_COLUMNS) {
    const row = col.rows.find((r) => r.id === id);
    if (row) return row;
  }
  return null;
}

async function tapeFor(id: string): Promise<EnvShareChance> {
  if (id === "giftnifty") {
    try {
      const gift = await fetchGiftNiftyQuote();
      return {
        id,
        prevClose: gift.prevClose,
        last: gift.last,
        changePct: gift.changePct,
      };
    } catch {
      return { id, prevClose: null, last: null, changePct: null };
    }
  }
  const inst = findInstrument(id);
  if (!inst || !envYahooAllowlist().has(inst.yahoo)) {
    return { id, prevClose: null, last: null, changePct: null };
  }
  try {
    const candles = await fetchDailyCandles(inst.yahoo);
    const last = candles.at(-1)?.close ?? null;
    const prevClose = candles.at(-2)?.close ?? null;
    const changePct =
      last != null && prevClose != null && prevClose !== 0 ? last / prevClose - 1 : null;
    const behavior = recognizeTape(candles);
    if (!behavior) {
      return { id, prevClose, last, changePct };
    }
    return {
      id,
      prevClose,
      last,
      changePct,
      chance1d: behavior.expected1d,
      hitRate: behavior.hitRate,
      regime: behavior.regime,
      structure: behavior.structure,
      sampleSize: behavior.sampleSize,
    };
  } catch {
    return { id, prevClose: null, last: null, changePct: null };
  }
}

export async function GET() {
  const rows = await Promise.all(ENV_SHARE_IDS.map((id) => tapeFor(id)));
  return NextResponse.json({ asOf: new Date().toISOString(), rows });
}
