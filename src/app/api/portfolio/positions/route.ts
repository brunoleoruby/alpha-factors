import { NextResponse } from "next/server";
import { parsePositionBook } from "@/lib/portfolio/positions";
import { readPositionFile, writePositionFile } from "@/lib/portfolio/store";

export async function GET() {
  try {
    const book = await readPositionFile();
    return NextResponse.json(book);
  } catch {
    return NextResponse.json({ error: "Could not read positions" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const book = parsePositionBook(body);
    await writePositionFile(book);
    return NextResponse.json({ ok: true, count: book.positions.length });
  } catch {
    return NextResponse.json({ error: "Could not save positions" }, { status: 500 });
  }
}
