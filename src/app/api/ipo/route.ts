import { NextResponse } from "next/server";
import { fetchNseIpoBook } from "@/lib/markets/nse-ipo";

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

export async function GET() {
  try {
    const body = await fetchNseIpoBook();
    if (body.error && empty(body)) {
      return NextResponse.json(body, { status: 502 });
    }
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "IPO feed down" }, { status: 502 });
  }
}
