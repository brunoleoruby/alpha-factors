import { formatPct } from "@/lib/format";
import { ENV_COLUMNS, type EnvInstrument } from "./environment";
import { GIFT_INSTRUMENT } from "./gift-nifty";
import { ENV_SHARE_IDS, type EnvShareChance } from "./share-ids";
import { downloadHtmlPng } from "@/lib/share/html-png";

export const ENV_SHARE_DISCLAIMER =
  "Disclaimer: Pre-market companion (06:30–09:15 IST), not a complete market view. Personal perspective plus delayed overnight prints. Not an offer, solicitation, or recommendation to buy or sell any security, and not investment, tax, or legal advice. Nifty 50 prints are delayed Yahoo previous closes. GIFT Nifty is a delayed NSE IX futures print used only as an open cue versus Nifty previous close. Chance 1d / analog hit are tape rhymes, not forecasts. Stance is a vol label, not a trade call. Boundary conditions are the author’s. Views can change. Eminent Corpus is not a SEBI-registered investment adviser. Do your own research.";

export const PRE_MARKET_WINDOW = "06:30–09:15 IST";

export const ENV_SHARE_NOTE_KEY = "eminent-corpus.env-share-note.v2";

export type EnvShareInsight = {
  mindset: string;
  experience: string;
  boundaries: string;
};

export const emptyInsight = (): EnvShareInsight => ({
  mindset: "",
  experience: "",
  boundaries: "",
});

export type EnvShareLine = {
  id: string;
  name: string;
  short: string;
  digits: number;
  prevClose: number | null;
  last: number | null;
  changePct: number | null;
  chance1d: number | null;
  hitRate: number | null;
  regime: string;
};

export type EnvShareGroup = {
  title: string;
  rows: EnvShareLine[];
};

export type EnvStance = {
  label: "Risk-on" | "Mixed" | "Defensive" | "Unread";
};

export type EnvOpenCue = {
  niftyPrev: number | null;
  niftyLast: number | null;
  giftLast: number | null;
  giftPrev: number | null;
  gapPts: number | null;
  gapPct: number | null;
};

export type EnvSharePayload = {
  asOf: string;
  session: string;
  stance: EnvStance;
  indiaVix: number | null;
  usVix: number | null;
  openCue: EnvOpenCue;
  insight: EnvShareInsight;
  window: string;
  groups: EnvShareGroup[];
};

const INDIA_IDS = ["nifty", "giftnifty", "indiavix"] as const;
const WORLD_IDS = ["spx", "ndx"] as const;
const MACRO_IDS = ["usdinr", "gold", "wti"] as const;

const BY_ID: Record<string, EnvInstrument> = Object.fromEntries(
  [...ENV_COLUMNS.flatMap((col) => col.rows), GIFT_INSTRUMENT].map((row) => [row.id, row]),
);

export function environmentStance(indiaVix: number | null, usVix: number | null): EnvStance {
  const useIndia = indiaVix != null && Number.isFinite(indiaVix);
  const vix = useIndia ? indiaVix : usVix != null && Number.isFinite(usVix) ? usVix : null;
  if (vix == null) return { label: "Unread" };
  if (vix < 15) return { label: "Risk-on" };
  if (vix <= 20) return { label: "Mixed" };
  return { label: "Defensive" };
}

export function localShareDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function preMarketClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const mins = hour * 60 + minute;
  const isWeekday = weekday !== "Sat" && weekday !== "Sun";
  const inHours = mins >= 6 * 60 + 30 && mins < 9 * 60 + 15;
  const hhmm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return {
    weekday,
    hhmm,
    isWeekday,
    inWindow: isWeekday && inHours,
    label: isWeekday && inHours ? `Pre-market window · ${hhmm} IST` : `Outside pre-market · ${hhmm} IST`,
  };
}

export function parseStoredInsight(raw: string | null): EnvShareInsight {
  if (!raw) return emptyInsight();
  try {
    const parsed = JSON.parse(raw) as Partial<EnvShareInsight>;
    if (parsed && typeof parsed === "object") {
      return {
        mindset: typeof parsed.mindset === "string" ? parsed.mindset : "",
        experience: typeof parsed.experience === "string" ? parsed.experience : "",
        boundaries: typeof parsed.boundaries === "string" ? parsed.boundaries : "",
      };
    }
  } catch {
    return { mindset: raw, experience: "", boundaries: "" };
  }
  return { mindset: raw, experience: "", boundaries: "" };
}

function lineFor(id: string, tape: Map<string, EnvShareChance>): EnvShareLine {
  const inst = BY_ID[id];
  const row = tape.get(id);
  return {
    id,
    name: inst?.name ?? id,
    short: inst?.short ?? id.toUpperCase(),
    digits: inst?.digits ?? 2,
    prevClose: row?.prevClose ?? null,
    last: row?.last ?? null,
    changePct: row?.changePct ?? null,
    chance1d: row?.chance1d ?? null,
    hitRate: row?.hitRate ?? null,
    regime: row?.regime ?? "",
  };
}

export function buildEnvSharePayload(
  tapeRows: EnvShareChance[],
  asOf: string,
  insight: EnvShareInsight,
): EnvSharePayload {
  const tape = new Map(tapeRows.map((row) => [row.id, row]));
  const indiaVix = tape.get("indiavix")?.last ?? null;
  const usVix = tape.get("vix")?.last ?? null;
  const nifty = tape.get("nifty");
  const gift = tape.get("giftnifty");
  const niftyPrev = nifty?.prevClose ?? null;
  const giftLast = gift?.last ?? null;
  const gapPts = niftyPrev != null && giftLast != null ? giftLast - niftyPrev : null;
  const gapPct = niftyPrev != null && giftLast != null && niftyPrev !== 0 ? giftLast / niftyPrev - 1 : null;
  return {
    asOf,
    session: `Pre-market · ${PRE_MARKET_WINDOW}`,
    stance: environmentStance(indiaVix, usVix),
    indiaVix,
    usVix,
    openCue: {
      niftyPrev,
      niftyLast: nifty?.last ?? null,
      giftLast,
      giftPrev: gift?.prevClose ?? null,
      gapPts,
      gapPct,
    },
    insight: {
      mindset: insight.mindset.trim(),
      experience: insight.experience.trim(),
      boundaries: insight.boundaries.trim(),
    },
    window: PRE_MARKET_WINDOW,
    groups: [
      { title: "Overnight India", rows: INDIA_IDS.map((id) => lineFor(id, tape)) },
      { title: "Overnight US", rows: WORLD_IDS.map((id) => lineFor(id, tape)) },
      { title: "Overnight macros", rows: MACRO_IDS.map((id) => lineFor(id, tape)) },
    ],
  };
}

function fmtLevel(n: number, digits: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtGap(payload: EnvSharePayload) {
  const { niftyPrev, giftLast, gapPts, gapPct } = payload.openCue;
  const prev = niftyPrev == null ? "—" : fmtLevel(niftyPrev, 2);
  const gift = giftLast == null ? "—" : fmtLevel(giftLast, 2);
  if (gapPts == null || gapPct == null) {
    return `Previous close (reference): Nifty 50 ${prev}. GIFT Nifty last ${gift}. Open cue unread.`;
  }
  const pts = `${gapPts > 0 ? "+" : ""}${gapPts.toLocaleString("en-IN", { maximumFractionDigits: 1 })} pts`;
  return `Previous close (reference): Nifty 50 ${prev}. GIFT Nifty last ${gift}. Open vs that previous close: ${pts} ${formatPct(gapPct)}.`;
}

export function envShareTextPrevious(payload: EnvSharePayload) {
  const vixIndia = payload.indiaVix == null ? "—" : payload.indiaVix.toFixed(1);
  const blocks = payload.groups.flatMap((group) => [
    "",
    group.title,
    ...group.rows.map((row) => {
      const prev = row.prevClose == null ? "—" : fmtLevel(row.prevClose, row.digits);
      const last = row.last == null ? "—" : fmtLevel(row.last, row.digits);
      const pct = row.changePct == null ? "—" : formatPct(row.changePct);
      return `${row.short}  previous close ${prev}  last ${last}  vs previous close ${pct}`;
    }),
  ]);
  return [
    "Eminent Corpus",
    "Pre-market · Previous session close",
    `${localShareDate(payload.asOf)}  ·  ${payload.session}`,
    `Before the NSE bell  ·  ${payload.window}`,
    `Stance  ${payload.stance.label}  ·  India VIX ${vixIndia}`,
    "",
    fmtGap(payload),
    ...blocks,
    "",
    ENV_SHARE_DISCLAIMER,
  ].join("\n");
}

export function envShareTextToday(payload: EnvSharePayload) {
  const { mindset, experience, boundaries } = payload.insight;
  const blocks = payload.groups.flatMap((group) => [
    "",
    group.title,
    ...group.rows.map((row) => {
      const chance = row.chance1d == null ? "—" : formatPct(row.chance1d);
      const hit = row.hitRate == null ? "—" : formatPct(row.hitRate);
      return `${row.short}  today's chance ${chance}  analog hit ${hit}${row.regime ? `  (${row.regime})` : ""}`;
    }),
  ]);
  return [
    "Eminent Corpus",
    "Pre-market · Today's insight",
    `${localShareDate(payload.asOf)}  ·  ${payload.session}`,
    `Before the NSE bell  ·  ${payload.window}`,
    "",
    "Mindset",
    mindset || "—",
    "",
    "Experience",
    experience || "—",
    "",
    "Boundary conditions",
    boundaries || "—",
    ...blocks,
    "",
    ENV_SHARE_DISCLAIMER,
  ].join("\n");
}

export function envShareText(payload: EnvSharePayload) {
  return [envShareTextPrevious(payload), "", "—", "", envShareTextToday(payload)].join("\n");
}

export function downloadEnvSharePng(card: HTMLElement, filename: string) {
  return downloadHtmlPng(card, filename);
}

export { ENV_SHARE_IDS };
export type { EnvShareChance };
