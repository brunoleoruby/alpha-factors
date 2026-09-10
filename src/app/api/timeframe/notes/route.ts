import { NextResponse } from "next/server";
import { readNoteFile, writeNoteFile } from "@/lib/journal/store";
import { parseNoteList } from "@/lib/journal/notes";

export async function GET() {
  try {
    const notes = await readNoteFile();
    return NextResponse.json({ notes });
  } catch {
    return NextResponse.json({ error: "Could not read time-frame notes" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const notes = parseNoteList(
      body && typeof body === "object" && "notes" in body
        ? (body as { notes: unknown }).notes
        : body,
    );
    await writeNoteFile(notes);
    return NextResponse.json({ ok: true, count: notes.length });
  } catch {
    return NextResponse.json({ error: "Could not save time-frame notes" }, { status: 500 });
  }
}
