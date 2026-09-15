import { NextResponse } from "next/server";
import { fetchNseBreadth } from "@/lib/markets/nse-breadth";

export async function GET() {
  try {
    const body = await fetchNseBreadth();
    if (body.error && !body.exchange && !body.indices.length) {
      return NextResponse.json(body, { status: 502 });
    }
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "NSE breadth down" }, { status: 502 });
  }
}
