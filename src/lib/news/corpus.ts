import { classifyHeadline, type Classification } from "./classify";
import { gaussian, hashString, mulberry32 } from "@/lib/rng";
import { EVENT_RULES, NAMES, type EventType } from "./taxonomy";

export type NewsItem = {
  id: string;
  date: string;
  symbol: string;
  headline: string;
  source: string;
  classification: Classification;
  /** Realized path after the print — used as the labeled behavior, never as a feature. */
  ret1d: number;
  ret5d: number;
  reversed: boolean;
  vec?: Float64Array;
};

const SOURCES = ["Reuters", "Bloomberg", "WSJ", "CNBC", "FT"];

const TEMPLATES: Record<EventType, string[]> = {
  earnings_beat: [
    "{name} beats quarterly estimates as {thing} demand stays firm",
    "{symbol} tops Wall Street EPS forecasts, revenue beat on {thing}",
    "{name} reports better-than-expected earnings, {thing} margins expand",
  ],
  earnings_miss: [
    "{name} misses estimates as {thing} weakness hits results",
    "{symbol} posts disappointing earnings, EPS below estimates",
    "{name} revenue shortfall on weaker-than-expected {thing} sales",
  ],
  guidance_raise: [
    "{name} raises guidance citing stronger {thing} pipeline",
    "{symbol} lifts outlook after {thing} orders accelerate",
    "{name} boosts forecast for the year on {thing} strength",
  ],
  guidance_cut: [
    "{name} cuts guidance on softer {thing} trends",
    "{symbol} lowers outlook, trims full-year forecast",
    "{name} slashes forecast after {thing} demand cools",
  ],
  analyst_upgrade: [
    "Street upgrades {symbol} to overweight, price target raised on {thing}",
    "Analyst upgrades {name} to buy, citing {thing} optionality",
  ],
  analyst_downgrade: [
    "Broker downgrades {symbol} to underweight, price target cut",
    "Analyst cuts {name} to sell on {thing} competition",
  ],
  mna: [
    "{name} in talks to acquire {thing} specialist in all-cash deal",
    "Report: {symbol} exploring sale, takeover interest builds",
    "{name} signs merger agreement for {thing} unit",
  ],
  legal: [
    "{name} faces class action lawsuit over {thing}",
    "DoJ probe into {symbol} {thing} practices, sources say",
    "{name} sued by states in antitrust case",
  ],
  product: [
    "{name} unveils new {thing} and rolls out nationwide",
    "{symbol} wins contract for {thing}, design win with large customer",
    "{name} gets FDA approval for {thing} program",
  ],
  outage: [
    "{name} hit by outage as {thing} systems go downed",
    "{symbol} production halted after fire at {thing} plant",
    "{name} discloses data breach affecting {thing} users",
  ],
  buyback: [
    "{name} announces $buyback share repurchase authorization",
    "{symbol} board approves tender offer and buyback plan",
  ],
  offering: [
    "{name} prices secondary offering of shares",
    "{symbol} launches convertible notes in dilutive offering",
  ],
  workforce: [
    "{name} plans layoffs and job cuts in {thing} group",
    "{symbol} expands workforce, adds jobs in {thing}",
    "{name} imposes hiring freeze across {thing}",
  ],
  regulation: [
    "Regulator opens review of {name} {thing} practices",
    "Tariff risk rises for {symbol} {thing} exports",
    "FTC antitrust ruling lands against {name}",
  ],
  macro: [
    "Inflation data, CPI print reshapes rate-cut bets; {symbol} in focus",
    "Federal Reserve signals path for rates; {thing} names react including {name}",
  ],
};

const THINGS: Record<string, string[]> = {
  Tech: ["AI chips", "cloud", "PCs", "ads", "search", "foundry"],
  Consumer: ["e-commerce", "ads", "retail", "logistics"],
  Auto: ["EV", "autopilot", "energy storage"],
  Financials: ["trading", "credit card", "net interest"],
  Energy: ["refining", "upstream", "LNG"],
  Health: ["pharmacy", "drug trial", "insurance"],
  Industrials: ["jetliners", "defense", "services"],
  Media: ["streaming", "parks", "ads"],
};

function tradingDates(count: number, start = "2025-03-03") {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function fill(template: string, symbol: string, name: string, thing: string) {
  return template
    .replaceAll("{symbol}", symbol)
    .replaceAll("{name}", name)
    .replaceAll("{thing}", thing)
    .replace("$buyback", "$8 billion");
}

/**
 * Builds a labeled news history. Subsequent returns are drawn from the
 * event's empirical fingerprint plus noise, so nearest-neighbor matching
 * recovers real behavior patterns instead of random fills.
 */
export function generateCorpus(seed = 7, sessions = 180): NewsItem[] {
  const rand = mulberry32(seed);
  const dates = tradingDates(sessions);
  const items: NewsItem[] = [];
  let n = 0;

  for (const date of dates) {
    const k = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < k; i++) {
      const name = NAMES[Math.floor(rand() * NAMES.length)];
      const rule = EVENT_RULES[Math.floor(rand() * EVENT_RULES.length)];
      const thingList = THINGS[name.sector] ?? ["core"];
      const thing = thingList[Math.floor(rand() * thingList.length)];
      const templates = TEMPLATES[rule.id];
      const headline = fill(templates[Math.floor(rand() * templates.length)], name.symbol, name.name, thing);
      const cls = classifyHeadline(headline);
      const shock = gaussian(rand) * 0.012;
      const ret1d = rule.typical1d * (0.7 + cls.intensity) + shock;
      const drift = rule.typical5d - rule.typical1d;
      const ret5d = ret1d + drift + gaussian(rand) * 0.01;
      const reversed = Math.sign(ret5d) !== Math.sign(ret1d) || Math.abs(ret5d) < Math.abs(ret1d) * 0.35;
      items.push({
        id: `n${hashString(headline + date + String(n++))}`,
        date,
        symbol: name.symbol,
        headline,
        source: SOURCES[Math.floor(rand() * SOURCES.length)],
        classification: cls,
        ret1d: Number(ret1d.toFixed(4)),
        ret5d: Number(ret5d.toFixed(4)),
        reversed,
      });
    }
  }

  return items;
}

export function attachClassification(headline: string, symbol: string, date: string, source = "Desk"): NewsItem {
  const cls = classifyHeadline(headline);
  return {
    id: `live-${hashString(headline + date)}`,
    date,
    symbol,
    headline,
    source,
    classification: cls,
    ret1d: 0,
    ret5d: 0,
    reversed: false,
  };
}
