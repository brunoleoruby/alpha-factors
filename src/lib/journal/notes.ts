export const TIME_FRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1D", "1W", "1M"] as const;

export type TimeFrameNote = {
  id: string;
  serial: number;
  date: string;
  time: string;
  timeframe: string;
  thoughts: string;
};

const KEY = "alpha-factors.timeframe-notes.v1";

export function emptyNoteForm(nextSerial: number): Omit<TimeFrameNote, "id"> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    serial: nextSerial,
    date: now.toISOString().slice(0, 10),
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    timeframe: "15m",
    thoughts: "",
  };
}

function normalize(raw: Record<string, unknown>): TimeFrameNote | null {
  if (typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    serial: Number(raw.serial) || 0,
    date: typeof raw.date === "string" ? raw.date : emptyNoteForm(1).date,
    time: typeof raw.time === "string" ? raw.time : "00:00",
    timeframe: typeof raw.timeframe === "string" ? raw.timeframe : "15m",
    thoughts: typeof raw.thoughts === "string" ? raw.thoughts : "",
  };
}

export function parseNoteList(raw: unknown): TimeFrameNote[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => (row && typeof row === "object" ? normalize(row as Record<string, unknown>) : null))
    .filter((row): row is TimeFrameNote => row !== null);
}

export function nextSerial(notes: TimeFrameNote[]) {
  return notes.reduce((max, n) => Math.max(max, n.serial), 0) + 1;
}

export function loadNotes(): TimeFrameNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return parseNoteList(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveNotes(notes: TimeFrameNote[]) {
  window.localStorage.setItem(KEY, JSON.stringify(notes));
}
