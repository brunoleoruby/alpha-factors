import { EVENT_RULES, type EventType } from "./taxonomy";
import { features, normalizeHeadline, tokenize } from "./text";

const POS = [
  "beat",
  "beats",
  "surge",
  "surges",
  "rally",
  "record",
  "approval",
  "wins",
  "raise",
  "raises",
  "upgrade",
  "upgrades",
  "buyback",
  "strong",
  "better",
  "topped",
  "soars",
];
const NEG = [
  "miss",
  "misses",
  "cut",
  "cuts",
  "slash",
  "slashes",
  "downgrade",
  "probe",
  "lawsuit",
  "outage",
  "recall",
  "weak",
  "disappoint",
  "shortfall",
  "breach",
  "ban",
  "plunge",
  "plunges",
  "insider",
  "upsi",
];

export type Classification = {
  eventType: EventType;
  eventScore: number;
  sentiment: number;
  intensity: number;
  tokens: string[];
  terms: string[];
  scores: Partial<Record<EventType, number>>;
};

function keywordHits(haystack: string, phrase: string) {
  return haystack.includes(phrase) ? 1 : 0;
}

export function classifyHeadline(headline: string): Classification {
  const norm = normalizeHeadline(headline);
  const tokens = tokenize(headline);
  const terms = features(headline);
  const scores: Partial<Record<EventType, number>> = {};

  for (const rule of EVENT_RULES) {
    let s = 0;
    for (const kw of rule.keywords) {
      s += keywordHits(norm, kw) * (kw.includes(" ") ? 2.2 : 1);
    }
    scores[rule.id] = s;
  }

  let eventType: EventType = EVENT_RULES[0].id;
  let eventScore = 0;
  for (const rule of EVENT_RULES) {
    const s = scores[rule.id] ?? 0;
    if (s > eventScore) {
      eventScore = s;
      eventType = rule.id;
    }
  }

  let sent = 0;
  for (const t of tokens) {
    if (POS.includes(t)) sent += 1;
    if (NEG.includes(t)) sent -= 1;
  }
  if (eventType.includes("miss") || eventType.includes("cut") || eventType === "legal" || eventType === "outage" || eventType === "offering" || eventType === "analyst_downgrade" || eventType === "insider_trading") {
    sent -= 0.6;
  }
  if (eventType.includes("beat") || eventType.includes("raise") || eventType === "buyback" || eventType === "mna" || eventType === "analyst_upgrade") {
    sent += 0.6;
  }
  if (/\blayoffs?\b|\bjob cuts\b/.test(norm)) sent += 0.2;
  if (/\bhiring freeze\b/.test(norm)) sent -= 0.4;

  const intensity =
    Math.min(
      1,
      eventScore / 3 +
        (/%|bps|billion|million/.test(norm) ? 0.15 : 0) +
        (/unexpected|plunges|soars|emergency|halted/.test(norm) ? 0.2 : 0) +
        Math.min(0.25, Math.abs(sent) * 0.08),
    ) || 0.12;

  const sentiment = Math.max(-1, Math.min(1, sent / 4));

  return {
    eventType: eventScore > 0 ? eventType : "macro",
    eventScore,
    sentiment,
    intensity,
    tokens,
    terms,
    scores,
  };
}
