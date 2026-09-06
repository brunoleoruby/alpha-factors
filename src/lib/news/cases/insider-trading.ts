import { classifyHeadline } from "../classify";
import { EVENT_BY_ID, EVENT_RULES, type EventType } from "../taxonomy";
import type { CasePrint, LabeledPrint, PriceMark } from "./polycab";

export type { CasePrint, LabeledPrint, PriceMark };

/** Public print dates. Infosys June 2021 PIT case and later SAT / SEBI close-out. */
export const INSIDER_NEWS: CasePrint[] = [
  {
    date: "2021-05-31",
    symbol: "INFY",
    name: "Infosys",
    headline:
      "SEBI passes interim ex-parte order in alleged insider trading; unpublished price-sensitive information around quarterly results; PIT restrictions on employees and connected persons",
    source: "SEBI",
    ret1d: -0.004,
    ret5d: 0.006,
    note: "Order dated 31 May. Markets digest it on 1–2 June. This is PIT, not a company raid.",
  },
  {
    date: "2021-06-01",
    symbol: "INFY",
    name: "Infosys",
    headline:
      "Infosys informed of interim ex-parte SEBI order in ongoing insider trading investigation; company to initiate internal probe under PIT regulations",
    source: "BSE filing",
    ret1d: -0.003,
    ret5d: 0.01,
    note: "Company names the investigation and a code of conduct. No admission of a leak in the filing.",
  },
  {
    date: "2021-06-02",
    symbol: "INFY",
    name: "Infosys",
    headline:
      "Infosys shares close lower after SEBI finds insider trading activity; unpublished price-sensitive information leak alleged around results week",
    source: "Press",
    ret1d: -0.0055,
    ret5d: 0.008,
    note: "NSE close about ₹1,381 (−0.45% that session). Intraday low about −1.8%. Large-cap PIT, not a circuit.",
  },
  {
    date: "2022-04-25",
    symbol: "INFY",
    name: "Infosys",
    headline:
      "SAT quashes SEBI restrictions in Infosys insider trading case; burden of proof on unpublished price-sensitive information not met",
    source: "SAT",
    ret1d: 0.004,
    ret5d: 0.006,
    note: "Tribunal lifts market-access bars on the named employees. Headline still classifies as insider trading because the statute is PIT.",
  },
  {
    date: "2024-09-09",
    symbol: "INFY",
    name: "Infosys",
    headline:
      "SEBI dismisses insider trading charges against Infosys staff and connected entities; PIT restrictions vacated, impounded funds to be released",
    source: "SEBI",
    ret1d: 0.002,
    ret5d: 0.003,
    note: "Final close-out. Material not enough to sustain the allegation. Stock barely notices.",
  },
];

export const SIMILAR_INSIDER: CasePrint[] = [
  {
    date: "2024-01-11",
    symbol: "POLYCAB",
    name: "Polycab India",
    headline:
      "Finance Ministry / CBDT says Income Tax search at Polycab found evidence of tax evasion; unaccounted cash and bogus invoices",
    source: "PIB / CBDT",
    ret1d: -0.21,
    ret5d: -0.08,
    note: "Legal / raid, not PIT. Same ‘regulator headline → selloff’ shape, different statute and a much worse 1d.",
  },
  {
    date: "2016-06-14",
    symbol: "ASHOKA",
    name: "Ashoka Buildcon",
    headline: "Ashoka Buildcon hits lower circuit after Income Tax and ED search reports at Nashik office",
    source: "Press",
    ret1d: -0.2,
    ret5d: -0.12,
    note: "Search/raid circuit. Do not rhyme this 1d onto an Infosys-style employee PIT print.",
  },
  {
    date: "2024-02-08",
    symbol: "RELIANCE",
    name: "Reliance Industries",
    headline:
      "Connected persons face insider-trading allegations under PIT regulations ahead of a refining print",
    source: "Desk analog",
    ret1d: -0.018,
    ret5d: -0.022,
    note: "Typical large-cap PIT fingerprint this desk starts from (~−2% 1d), still milder than a raid.",
  },
  {
    date: "2023-01-27",
    symbol: "ADANIENT",
    name: "Adani Enterprises",
    headline:
      "Hindenburg Research investigation alleges stock manipulation and accounting fraud at Adani Group; company calls report malicious",
    source: "Hindenburg / company",
    ret1d: -0.19,
    ret5d: -0.28,
    note: "Legal / probe, not insider trading. Use it to keep the two event types apart.",
  },
  {
    date: "2023-10-12",
    symbol: "TCS",
    name: "Tata Consultancy Services",
    headline: "TCS beats quarterly estimates as IT services demand stays firm",
    source: "Results",
    ret1d: 0.012,
    ret5d: 0.008,
    note: "IT peer, earnings beat — not a PIT print. Shows the sector without the legal overlay.",
  },
];

/** NSE-style closes around the June 2021 window. 2 Jun close from contemporaneous reports. */
export const INFY_PRICE: PriceMark[] = [
  { date: "2021-05-28", close: 1392 },
  { date: "2021-05-31", close: 1388, label: "SEBI order" },
  { date: "2021-06-01", close: 1387, label: "Filing" },
  { date: "2021-06-02", close: 1381, label: "−0.45%" },
  { date: "2021-06-03", close: 1386 },
  { date: "2021-06-04", close: 1394 },
  { date: "2021-06-07", close: 1406 },
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

export const INSIDER_LABELED = labelAll(INSIDER_NEWS);
export const SIMILAR_INSIDER_LABELED = labelAll(SIMILAR_INSIDER);

export const CASE_CATEGORIES = EVENT_RULES.map((r) => ({
  id: r.id,
  label: r.label,
  description: r.description,
  typical1d: r.typical1d,
  typical5d: r.typical5d,
}));

export function insiderCategoriesInPlay(): EventType[] {
  return [...new Set(INSIDER_LABELED.map((p) => p.eventType))];
}
