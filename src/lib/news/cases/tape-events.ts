import { classifyHeadline } from "../classify";
import { EVENT_BY_ID, EVENT_RULES } from "../taxonomy";
import type { CasePrint, LabeledPrint } from "./polycab";

export type { CasePrint, LabeledPrint };

export const TAPE_EVENT_IDS = ["promoter_pledge", "qip_block", "usfda", "rating_cut"] as const;
export type TapeEventId = (typeof TAPE_EVENT_IDS)[number];

export const TAPE_NEWS: CasePrint[] = [
  {
    date: "2023-01-24",
    symbol: "ADANIENT",
    name: "Adani Enterprises",
    headline:
      "Hindenburg Research investigation alleges stock manipulation and accounting fraud at Adani Group; company calls report malicious",
    source: "Hindenburg / company",
    ret1d: -0.19,
    ret5d: -0.28,
    note: "Legal / probe. Same week as the pledge print — keep the two event types apart.",
  },
  {
    date: "2023-01-27",
    symbol: "ADANIENT",
    name: "Adani Enterprises",
    headline:
      "Adani Group tops up collateral on a $1 billion loan with pledged shares after the stock rout; encumbrance / promoter pledge cover raised",
    source: "Bloomberg / ET",
    ret1d: -0.18,
    ret5d: -0.22,
    note: "Pledge / collateral top-up, not the Hindenburg statute. Friday of that week: flagship names −16% to −20%.",
  },
  {
    date: "2023-02-01",
    symbol: "ADANIENT",
    name: "Adani Enterprises",
    headline:
      "Adani Enterprises pulls Rs 20,000 crore follow-on public offer after the selloff; FPO will not go ahead",
    source: "Exchange / Bloomberg",
    ret1d: -0.08,
    ret5d: -0.05,
    note: "Cancelled FPO is dilution/offering language, not a QIP print. Classifies as dilutive offering.",
  },
  {
    date: "2023-06-12",
    symbol: "VEDL",
    name: "Vedanta",
    headline: "Vedanta promoters increase pledged shares and encumbrance against group loans",
    source: "Desk analog",
    ret1d: -0.031,
    ret5d: -0.044,
    note: "Typical pledge fingerprint on a metals name without a Hindenburg overlay.",
  },
  {
    date: "2020-07-31",
    symbol: "HDFCBANK",
    name: "HDFC Bank",
    headline: "HDFC Bank announces qualified institutional placement of shares; QIP to raise capital",
    source: "Exchange",
    ret1d: -0.016,
    ret5d: -0.008,
    note: "Large-cap QIP: sold a little on the print, not a pledge cascade.",
  },
  {
    date: "2023-08-08",
    symbol: "ZOMATO",
    name: "Eternal (Zomato)",
    headline: "Block deal in ZOMATO as institutions place stock; bulk deal on NSE",
    source: "Desk analog",
    ret1d: -0.022,
    ret5d: -0.01,
    note: "Block/bulk tape — same QIP / block bucket, usually a one-day discount.",
  },
  {
    date: "2023-01-18",
    symbol: "AUROPHARMA",
    name: "Aurobindo Pharma",
    headline:
      "USFDA issues Form 483 with 2 observations at APL Health Care Units I & III, Jadcherla; company says observations are procedural",
    source: "Exchange filing",
    ret1d: 0.0035,
    ret5d: 0.012,
    note: "Two procedural 483s. BSE close that session was slightly green (~+0.35%). Not every USFDA print is a gap-down.",
  },
  {
    date: "2017-06-12",
    symbol: "LUPIN",
    name: "Lupin",
    headline: "USFDA issues Form 483 at Lupin Goa plant; warning letter risk after inspection",
    source: "Desk analog",
    ret1d: -0.062,
    ret5d: -0.04,
    note: "Harsher 483 / warning-letter shape — the fingerprint this desk starts from, vs Aurobindo’s green close.",
  },
  {
    date: "2018-09-21",
    symbol: "YESBANK",
    name: "Yes Bank",
    headline: "Moody's downgrades Yes Bank credit rating citing asset-quality and capital stress",
    source: "Press",
    ret1d: -0.07,
    ret5d: -0.11,
    note: "Credit rating cut, not a Street target cut. Stuck through the session.",
  },
  {
    date: "2019-02-14",
    symbol: "YESBANK",
    name: "Yes Bank",
    headline: "ICRA downgrades Yes Bank after further asset-quality deterioration; credit rating cut",
    source: "Press",
    ret1d: -0.09,
    ret5d: -0.14,
    note: "Second credit cut. Same category, more follow-through than an analyst downgrade.",
  },
  {
    date: "2023-10-12",
    symbol: "TCS",
    name: "Tata Consultancy Services",
    headline: "Street upgrades TCS to overweight, price target raised on IT services",
    source: "Desk analog",
    ret1d: 0.008,
    ret5d: 0.01,
    note: "Analyst upgrade — must not land on credit rating cut.",
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

export const TAPE_LABELED = labelAll(TAPE_NEWS);

export const TAPE_CATEGORIES = EVENT_RULES.filter((r) =>
  (TAPE_EVENT_IDS as readonly string[]).includes(r.id),
).map((r) => ({
  id: r.id,
  label: r.label,
  description: r.description,
  typical1d: r.typical1d,
  typical5d: r.typical5d,
}));

