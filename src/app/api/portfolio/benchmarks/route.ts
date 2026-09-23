import { NextRequest, NextResponse } from "next/server";
import { fetchNseIndexCandles } from "@/lib/markets/nse-index-history";
import { closeToCloseReturn, fetchDailyCandles } from "@/lib/markets/yahoo-daily";

const BENCH = [
  { id: "nifty50", yahoo: "^NSEI", nse: "NIFTY 50", name: "Nifty 50" },
  { id: "smallcap", yahoo: "NIFTY_SMLCAP_100.NS", nse: "NIFTY SMALLCAP 100", name: "Nifty Smallcap 100" },
] as const;

async function periodReturn(row: (typeof BENCH)[number], from: string, to: string) {
  try {
    const yahoo = await fetchDailyCandles(row.yahoo);
    const viaYahoo = closeToCloseReturn(yahoo, from, to);
    if (viaYahoo != null) return viaYahoo;
  } catch {
    /* NSE fallback — Yahoo has no daily history for Smallcap 100 */
  }
  const nse = await fetchNseIndexCandles(row.nse, from, to);
  return closeToCloseReturn(nse, from, to);
}

export async function GET(req: NextRequest) {
  const from = (req.nextUrl.searchParams.get("from") ?? "").slice(0, 10);
  const to = (req.nextUrl.searchParams.get("to") ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Need from and to as yyyy-mm-dd" }, { status: 400 });
  }
  try {
    const rows = await Promise.all(
      BENCH.map(async (row) => {
        try {
          return { id: row.id, name: row.name, return: await periodReturn(row, from, to) };
        } catch {
          return { id: row.id, name: row.name, return: null as number | null };
        }
      }),
    );
    return NextResponse.json({ from, to, source: "Yahoo · NSE", rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Benchmark feed down";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
