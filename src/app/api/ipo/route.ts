import { NextResponse } from "next/server";
import { fetchChittorIpoBook } from "@/lib/markets/chittorgarh-ipo";

function empty(book: { main: { open: unknown[]; upcoming: unknown[]; recent: unknown[] }; sme: { open: unknown[]; upcoming: unknown[]; recent: unknown[] } }) {
  return (
    !book.main.open.length &&
    !book.main.upcoming.length &&
    !book.main.recent.length &&
    !book.sme.open.length &&
    !book.sme.upcoming.length &&
    !book.sme.recent.length
  );
}

export async function GET(req: Request) {
  try {
    const scrape = new URL(req.url).searchParams.get("sectors") === "1";
    const body = await fetchChittorIpoBook({ scrape });
    if (body.error && empty(body)) {
      return NextResponse.json(body, { status: 502 });
    }
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "IPO feed down" }, { status: 502 });
  }
}
