export const VERDICTS = ["open", "killed", "survived"] as const;
export type TrialVerdict = (typeof VERDICTS)[number];

export type TimeFrameNote = {
  id: string;
  serial: number;
  date: string;
  time: string;
  timeframe: string;
  thoughts: string;
  verdict: TrialVerdict;
  tStat: number | null;
};

const KEY = "alpha-factors.timeframe-notes.v2";
const LEGACY_KEY = "alpha-factors.timeframe-notes.v1";

export function emptyNoteForm(nextSerial: number): Omit<TimeFrameNote, "id"> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    serial: nextSerial,
    date: now.toISOString().slice(0, 10),
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    timeframe: "",
    thoughts: "",
    verdict: "open",
    tStat: null,
  };
}

function asVerdict(value: unknown): TrialVerdict {
  return VERDICTS.includes(value as TrialVerdict) ? (value as TrialVerdict) : "open";
}

function asTStat(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalize(raw: Record<string, unknown>): TimeFrameNote | null {
  if (typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    serial: Number(raw.serial) || 0,
    date: typeof raw.date === "string" ? raw.date : emptyNoteForm(1).date,
    time: typeof raw.time === "string" ? raw.time : "00:00",
    timeframe: typeof raw.timeframe === "string" ? raw.timeframe : "",
    thoughts: typeof raw.thoughts === "string" ? raw.thoughts : "",
    verdict: asVerdict(raw.verdict),
    tStat: asTStat(raw.tStat),
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

export function trialTally(notes: TimeFrameNote[]) {
  return {
    n: notes.length,
    open: notes.filter((n) => n.verdict === "open").length,
    killed: notes.filter((n) => n.verdict === "killed").length,
    survived: notes.filter((n) => n.verdict === "survived").length,
  };
}

export function loadNotes(): TimeFrameNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    return parseNoteList(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveNotes(notes: TimeFrameNote[]) {
  window.localStorage.setItem(KEY, JSON.stringify(notes));
}
