import type { NewsItem } from "./corpus";
import { cosine, makeSpace, vectorize, type VectorSpace } from "./tfidf";
import { EVENT_BY_ID, type EventType, type StrategyConfig } from "./taxonomy";

export type PatternMatch = {
  id: string;
  date: string;
  symbol: string;
  headline: string;
  eventType: EventType;
  similarity: number;
  ret1d: number;
  ret5d: number;
  reversed: boolean;
};

export type BehaviorForecast = {
  eventType: EventType;
  eventLabel: string;
  sentiment: number;
  intensity: number;
  expected1d: number;
  expected5d: number;
  hitRate: number;
  reversalRate: number;
  sampleSize: number;
  confidence: number;
  cascade: boolean;
  echo: boolean;
  cascadeCount: number;
  matches: PatternMatch[];
  side: "long" | "short" | "skip";
};

function mean(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function daysBetween(a: string, b: string) {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
}

export function indexCorpus(items: NewsItem[]): VectorSpace {
  const space = makeSpace(items.map((it) => it.classification.terms));
  for (const it of items) {
    it.vec = vectorize(space, it.classification);
  }
  return space;
}

export function recognize(
  item: NewsItem,
  history: NewsItem[],
  space: VectorSpace,
  config: StrategyConfig,
): BehaviorForecast {
  const query = item.vec ?? vectorize(space, item.classification);
  const scored: PatternMatch[] = [];

  for (const prior of history) {
    if (prior.id === item.id) continue;
    if (prior.date >= item.date) continue;
    const sim = cosine(query, prior.vec ?? vectorize(space, prior.classification));
    if (sim < 0.08) continue;
    scored.push({
      id: prior.id,
      date: prior.date,
      symbol: prior.symbol,
      headline: prior.headline,
      eventType: prior.classification.eventType,
      similarity: sim,
      ret1d: prior.ret1d,
      ret5d: prior.ret5d,
      reversed: prior.reversed,
    });
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  const matches = scored.slice(0, 8);
  const sameEvent = history.filter(
    (h) => h.classification.eventType === item.classification.eventType && h.date < item.date,
  );

  const w = matches.map((m) => Math.max(m.similarity, 0.01));
  const wsum = w.reduce((a, b) => a + b, 0) || 1;
  const expected1d = matches.length
    ? matches.reduce((acc, m, i) => acc + m.ret1d * w[i], 0) / wsum
    : EVENT_BY_ID[item.classification.eventType].typical1d * item.classification.intensity;
  const expected5d = matches.length
    ? matches.reduce((acc, m, i) => acc + m.ret5d * w[i], 0) / wsum
    : EVENT_BY_ID[item.classification.eventType].typical5d * item.classification.intensity;

  const hitRate = matches.length
    ? matches.filter((m) => Math.sign(m.ret1d) === Math.sign(expected1d) || expected1d === 0).length /
      matches.length
    : 0.5;
  const reversalRate = matches.length ? matches.filter((m) => m.reversed).length / matches.length : 0.4;

  const recentSame = history.filter(
    (h) =>
      h.symbol === item.symbol &&
      h.classification.eventType === item.classification.eventType &&
      h.date < item.date &&
      daysBetween(h.date, item.date) <= 2,
  );
  const cascade = recentSame.length >= 1;
  const echo = matches.some(
    (m) => m.symbol === item.symbol && m.similarity > 0.82 && daysBetween(m.date, item.date) <= 5,
  );

  let confidence =
    Math.min(1, matches.length / 6) * 0.35 +
    Math.min(1, sameEvent.length / 12) * 0.15 +
    item.classification.intensity * 0.2 +
    (matches[0]?.similarity ?? 0) * 0.25 +
    Math.min(0.15, Math.abs(expected1d) * 4);

  if (config.cascadeBoost && cascade) {
    confidence = Math.min(1, confidence + 0.08 * recentSame.length);
  }
  if (config.skipEcho && echo) {
    confidence *= 0.55;
  }

  let side: BehaviorForecast["side"] = "skip";
  if (confidence >= config.minConfidence && Math.abs(expected1d) >= config.minAbsMove) {
    side = expected1d > 0 ? "long" : "short";
  }

  return {
    eventType: item.classification.eventType,
    eventLabel: EVENT_BY_ID[item.classification.eventType].label,
    sentiment: item.classification.sentiment,
    intensity: item.classification.intensity,
    expected1d,
    expected5d,
    hitRate,
    reversalRate,
    sampleSize: matches.length,
    confidence,
    cascade,
    echo,
    cascadeCount: recentSame.length,
    matches,
    side,
  };
}

export function eventFingerprints(history: NewsItem[]) {
  const groups = new Map<EventType, NewsItem[]>();
  for (const h of history) {
    const list = groups.get(h.classification.eventType) ?? [];
    list.push(h);
    groups.set(h.classification.eventType, list);
  }
  return [...groups.entries()].map(([id, list]) => ({
    id,
    label: EVENT_BY_ID[id].label,
    n: list.length,
    avg1d: mean(list.map((x) => x.ret1d)),
    avg5d: mean(list.map((x) => x.ret5d)),
    reversal: list.filter((x) => x.reversed).length / list.length,
  }));
}
