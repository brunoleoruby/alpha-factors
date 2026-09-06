import { classifyHeadline } from "../classify";
import { EVENT_BY_ID, EVENT_RULES, type EventType } from "../taxonomy";

export type CasePrint = {
  date: string;
  symbol: string;
  name: string;
  headline: string;
  source: string;
  ret1d: number;
  ret5d: number;
  note: string;
};

export type LabeledPrint = CasePrint & {
  eventType: EventType;
  eventLabel: string;
  sentiment: number;
};

export type PriceMark = {
  date: string;
  close: number;
  label?: string;
};

/** Public print dates and reactions, Dec 2023 – Jan 2024. */
export const POLYCAB_NEWS: CasePrint[] = [
  {
    date: "2023-12-22",
    symbol: "POLYCAB",
    name: "Polycab India",
    headline:
      "Income Tax Department conducts search operations at Polycab group plants and offices across more than 50 premises",
    source: "Exchange / PIB later",
    ret1d: -0.06,
    ret5d: -0.09,
    note: "Searches began 22 Dec. The stock slipped that session; the violent crash came when the ministry went public in January.",
  },
  {
    date: "2024-01-09",
    symbol: "POLYCAB",
    name: "Polycab India",
    headline:
      "Polycab India denies reports of tax evasion; says it has not received written outcome of the December search",
    source: "BSE filing",
    ret1d: -0.04,
    ret5d: -0.22,
    note: "Denial without a clean bill of health. Selling accelerated into the official statement.",
  },
  {
    date: "2024-01-11",
    symbol: "POLYCAB",
    name: "Polycab India",
    headline:
      "CBDT says search found unaccounted cash sales of about Rs 1,000 crore; over Rs 4 crore cash seized, 25 lockers restrained",
    source: "CBDT / PIB",
    ret1d: -0.21,
    ret5d: -0.08,
    note: "Steepest fall since listing. BSE close about Rs 3,877 (−21%). Market cap ~Rs 15,500 crore wiped.",
  },
  {
    date: "2024-01-18",
    symbol: "POLYCAB",
    name: "Polycab India",
    headline:
      "Polycab India Q3 net profit rises 15% YoY to about Rs 416 crore; revenue up 17% to Rs 4,340 crore",
    source: "Company results",
    ret1d: -0.005,
    ret5d: -0.04,
    note: "A clean earnings beat that did not gap up. Wires & cables +17%; FMEG −13%. Tax overhang dominated the tape.",
  },
  {
    date: "2024-01-19",
    symbol: "POLYCAB",
    name: "Polycab India",
    headline:
      "Goldman Sachs maintains buy on Polycab with Rs 5,750 target; Jefferies buy, Rs 7,000 target, awaiting more on the IT search",
    source: "Street notes",
    ret1d: -0.04,
    ret5d: -0.02,
    note: "Upgrades/maintains while the stock still printed a second down day after results (intraday low near Rs 4,250).",
  },
];

export const POLYCAB_PRICE: PriceMark[] = [
  { date: "2023-12-21", close: 5620, label: "Pre-search close" },
  { date: "2023-12-22", close: 5280, label: "Search starts" },
  { date: "2023-12-29", close: 5050 },
  { date: "2024-01-08", close: 4920 },
  { date: "2024-01-09", close: 4720, label: "Denial" },
  { date: "2024-01-11", close: 3877, label: "CBDT print −21%" },
  { date: "2024-01-15", close: 4180 },
  { date: "2024-01-18", close: 4431, label: "Q3 earnings" },
  { date: "2024-01-19", close: 4250, label: "Beat fades" },
];

/** Same event type, other names — how price usually behaved. */
export const SIMILAR_EVENTS: CasePrint[] = [
  {
    date: "2016-06-14",
    symbol: "ASHOKA",
    name: "Ashoka Buildcon",
    headline: "Ashoka Buildcon hits lower circuit after Income Tax and ED search reports at Nashik office",
    source: "Press",
    ret1d: -0.2,
    ret5d: -0.12,
    note: "Same legal category: search/raid. Circuit-limit selloff.",
  },
  {
    date: "2023-12-14",
    symbol: "MANKIND",
    name: "Mankind Pharma",
    headline: "Income Tax Department conducting search at Mankind Pharma premises and some subsidiaries",
    source: "Exchange filing",
    ret1d: -0.006,
    ret5d: 0.01,
    note: "Same legal category, different path: intraday washout then close almost flat (−0.6%).",
  },
  {
    date: "2023-01-27",
    symbol: "ADANIENT",
    name: "Adani Enterprises",
    headline: "Hindenburg Research investigation alleges stock manipulation and accounting fraud at Adani Group; company calls report malicious",
    source: "Hindenburg / company",
    ret1d: -0.19,
    ret5d: -0.28,
    note: "Legal / probe, not a tax raid, but the same ‘investigation headline → gap-down’ pattern.",
  },
  {
    date: "2024-01-18",
    symbol: "HAVELLS",
    name: "Havells India",
    headline: "Havells India reports quarterly earnings; cables peer tape in focus after Polycab tax news",
    source: "Desk note",
    ret1d: -0.012,
    ret5d: -0.008,
    note: "Same sector, no raid. Mild sympathy, not a 21% legal crash.",
  },
  {
    date: "2023-10-12",
    symbol: "KEI",
    name: "KEI Industries",
    headline: "KEI Industries beats quarterly estimates as cable demand stays firm",
    source: "Results",
    ret1d: 0.021,
    ret5d: 0.014,
    note: "Same earnings-beat category without a legal overhang — beat actually bid the name.",
  },
  {
    date: "2023-01-12",
    symbol: "INFY",
    name: "Infosys",
    headline: "Infosys beats quarterly estimates; guidance stays cautious on large-deal conversion",
    source: "Results",
    ret1d: -0.018,
    ret5d: -0.011,
    note: "Earnings beat that sold off — useful rhyme for Polycab’s 18 Jan print (beat, no gap-up).",
  },
];

function labelAll(rows: CasePrint[]): LabeledPrint[] {
  return rows.map((row) => {
    const cls = classifyHeadline(row.headline);
    return {
      ...row,
      eventType: cls.eventType,
      eventLabel: EVENT_BY_ID[cls.eventType].label,
      sentiment: cls.sentiment,
    };
  });
}

export const POLYCAB_LABELED = labelAll(POLYCAB_NEWS);
export const SIMILAR_LABELED = labelAll(SIMILAR_EVENTS);

export const CASE_CATEGORIES = EVENT_RULES.map((r) => ({
  id: r.id,
  label: r.label,
  description: r.description,
  typical1d: r.typical1d,
  typical5d: r.typical5d,
}));

export function categoriesInPlay() {
  return [...new Set(POLYCAB_LABELED.map((p) => p.eventType))];
}
