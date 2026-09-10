import { promises as fs } from "fs";
import path from "path";
import { parseNoteList, type TimeFrameNote } from "./notes";

const FILE = path.join(process.cwd(), "data", "timeframe-notes.json");

export async function readNoteFile(): Promise<TimeFrameNote[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return parseNoteList(JSON.parse(raw) as unknown);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function writeNoteFile(notes: TimeFrameNote[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(notes, null, 2)}\n`, "utf8");
  await fs.rename(tmp, FILE);
}
