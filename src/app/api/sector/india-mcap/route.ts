import { NextResponse } from "next/server";
import { fetchIndiaSectorCaps } from "@/lib/markets/india-sector-mcap";

export async function GET() {
  try {
    return NextResponse.json(await fetchIndiaSectorCaps());
  } catch {
    return NextResponse.json({ error: "India sector market-cap feed down" }, { status: 502 });
  }
}
