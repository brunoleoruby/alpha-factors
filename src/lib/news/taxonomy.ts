export const EVENT_TYPES = [
  "earnings_beat",
  "earnings_miss",
  "guidance_raise",
  "guidance_cut",
  "analyst_upgrade",
  "analyst_downgrade",
  "mna",
  "legal",
  "product",
  "outage",
  "buyback",
  "offering",
  "workforce",
  "regulation",
  "macro",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type EventRule = {
  id: EventType;
  label: string;
  description: string;
  keywords: string[];
  typical1d: number;
  typical5d: number;
  reversal: number;
};

export const EVENT_RULES: EventRule[] = [
  {
    id: "earnings_beat",
    label: "Earnings beat",
    description: "Results above estimates; often a gap-up that can fade.",
    keywords: ["beats", "beat estimates", "topped estimates", "eps above", "revenue beat", "better-than-expected earnings", "surpasses estimates", "net profit rises", "profit rises"],
    typical1d: 0.018,
    typical5d: 0.012,
    reversal: 0.38,
  },
  {
    id: "earnings_miss",
    label: "Earnings miss",
    description: "Results below estimates; often a gap-down with follow-through.",
    keywords: ["misses", "missed estimates", "below estimates", "eps miss", "shortfall", "disappointing earnings", "weaker-than-expected"],
    typical1d: -0.022,
    typical5d: -0.016,
    reversal: 0.32,
  },
  {
    id: "guidance_raise",
    label: "Guidance raise",
    description: "Company lifts outlook; tends to trend rather than fade.",
    keywords: ["raises guidance", "lifts outlook", "boosts forecast", "full-year outlook raised", "increases guidance"],
    typical1d: 0.024,
    typical5d: 0.031,
    reversal: 0.22,
  },
  {
    id: "guidance_cut",
    label: "Guidance cut",
    description: "Company cuts outlook; among the stickiest negative patterns.",
    keywords: ["cuts guidance", "lowers outlook", "slashes forecast", "withdraws guidance", "trims outlook"],
    typical1d: -0.028,
    typical5d: -0.041,
    reversal: 0.18,
  },
  {
    id: "analyst_upgrade",
    label: "Analyst upgrade",
    description: "Street raises rating or target; usually a mild positive drift.",
    keywords: ["upgrades", "raised to overweight", "raised to buy", "price target raised", "initiates overweight", "maintains buy"],
    typical1d: 0.009,
    typical5d: 0.011,
    reversal: 0.41,
  },
  {
    id: "analyst_downgrade",
    label: "Analyst downgrade",
    description: "Street cuts rating or target; mild negative, often mean-reverting.",
    keywords: ["downgrades", "cut to underweight", "cut to sell", "price target cut", "initiates underweight"],
    typical1d: -0.011,
    typical5d: -0.008,
    reversal: 0.44,
  },
  {
    id: "mna",
    label: "M&A / deal",
    description: "Takeover, acquisition, or merger talk; jump then digest.",
    keywords: ["to acquire", "acquisition of", "buyout", "takeover", "merger agreement", "all-cash deal", "exploring sale"],
    typical1d: 0.035,
    typical5d: 0.021,
    reversal: 0.29,
  },
  {
    id: "legal",
    label: "Legal / probe",
    description: "Lawsuit, investigation, or fine; negative with slow bleed.",
    keywords: ["lawsuit", "sued", "investigation", "doj probe", "sec probe", "antitrust", "class action", "settlement", "raid", "raids", "income tax", "search and seizure", "search operations", "tax evasion", "cbdt"],
    typical1d: -0.019,
    typical5d: -0.017,
    reversal: 0.27,
  },
  {
    id: "product",
    label: "Product / launch",
    description: "Launch, approval, or win; positive but noisy.",
    keywords: ["unveils", "launches", "fda approval", "wins contract", "new product", "rolls out", "design win"],
    typical1d: 0.013,
    typical5d: 0.015,
    reversal: 0.36,
  },
  {
    id: "outage",
    label: "Outage / incident",
    description: "Downtime, recall, or safety event; sharp then partial bounce.",
    keywords: ["outage", "downed", "recall", "halted production", "cyberattack", "data breach", "fire at"],
    typical1d: -0.026,
    typical5d: -0.009,
    reversal: 0.48,
  },
  {
    id: "buyback",
    label: "Buyback",
    description: "Share repurchase authorization; supportive bid.",
    keywords: ["share repurchase", "buyback", "repurchase authorization", "tender offer"],
    typical1d: 0.008,
    typical5d: 0.014,
    reversal: 0.25,
  },
  {
    id: "offering",
    label: "Dilutive offering",
    description: "Secondary or convert; typically sold on the print.",
    keywords: ["secondary offering", "share offering", "priced offering", "convertible notes", "dilutive"],
    typical1d: -0.016,
    typical5d: -0.012,
    reversal: 0.33,
  },
  {
    id: "workforce",
    label: "Workforce",
    description: "Layoffs vs hiring; mixed, layoff often read as a cut-costs positive.",
    keywords: ["layoffs", "job cuts", "restructuring", "hiring freeze", "adds jobs", "expands workforce"],
    typical1d: 0.004,
    typical5d: 0.002,
    reversal: 0.45,
  },
  {
    id: "regulation",
    label: "Regulation",
    description: "Policy, tariff, or license news; sign depends on wording.",
    keywords: ["regulator", "fcc", "ftc", "tariff", "export ban", "license revoked", "antitrust ruling", "sebi", "rbi", "gst"],
    typical1d: -0.007,
    typical5d: -0.006,
    reversal: 0.4,
  },
  {
    id: "macro",
    label: "Macro / rates",
    description: "Fed, CPI, oil — market-wide tone more than a single name.",
    keywords: ["federal reserve", "rate cut", "rate hike", "cpi", "inflation data", "jobs report", "oil prices", "repo rate", "rbi", "fii"],
    typical1d: 0.002,
    typical5d: 0.001,
    reversal: 0.5,
  },
];

export const EVENT_BY_ID = Object.fromEntries(EVENT_RULES.map((r) => [r.id, r])) as Record<
  EventType,
  EventRule
>;

import { US_LISTINGS } from "@/lib/markets/us";

export const NAMES = US_LISTINGS;

export type StrategyConfig = {
  minConfidence: number;
  minAbsMove: number;
  holdSessions: number;
  cascadeBoost: boolean;
  skipEcho: boolean;
  capital: number;
  costBps: number;
};

export const DEFAULT_STRATEGY: StrategyConfig = {
  minConfidence: 0.42,
  minAbsMove: 0.006,
  holdSessions: 5,
  cascadeBoost: true,
  skipEcho: true,
  capital: 1_000_000,
  costBps: 8,
};

export const DEFAULT_STRATEGY_NSE: StrategyConfig = {
  ...DEFAULT_STRATEGY,
  capital: 10_000_000,
};
