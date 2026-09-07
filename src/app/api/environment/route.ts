import { NextResponse } from "next/server";
import { fetchEnvironmentQuotes } from "@/lib/markets/environment-quotes";

export async function GET() {
  try {
    const { asOf, quotes } = await fetchEnvironmentQuotes();
    const live = quotes.filter((q) => q.last != null).length;
    return NextResponse.json({
      asOf,
      live,
      total: quotes.length,
      quotes,
    });
  } catch {
    return NextResponse.json({ error: "Quote feed down" }, { status: 502 });
  }
}
