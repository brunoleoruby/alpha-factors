import { classifyHeadline } from "./classify";
import { generateCorpus, NSE_SOURCES, type NewsItem } from "./corpus";
import type { Listing } from "@/lib/markets/types";
import { US_LISTINGS } from "@/lib/markets/us";
import { eventFingerprints, indexCorpus, recognize, type BehaviorForecast } from "./patterns";
import { trainNewsNet, type NeuralFit } from "./nn";
import { DEFAULT_STRATEGY, type StrategyConfig } from "./taxonomy";
import { vectorize } from "./tfidf";

export type Trade = {
  date: string;
  symbol: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  headline: string;
  reason: string;
  confidence: number;
};

export type Position = {
  symbol: string;
  shares: number;
  avgPrice: number;
  openedOn: string;
  exitOn: string;
  headline: string;
};

export type EquityPoint = {
  date: string;
  equity: number;
  cash: number;
  drawdown: number;
};

export type AnalyzedItem = NewsItem & {
  forecast: BehaviorForecast;
};

export type NewsState = {
  corpus: NewsItem[];
  asOfIndex: number;
  dates: string[];
  analyzed: AnalyzedItem[];
  tape: AnalyzedItem[];
  trades: Trade[];
  positions: Position[];
  equity: EquityPoint[];
  cash: number;
  fingerprints: ReturnType<typeof eventFingerprints>;
  selectedId: string | null;
  listings: Listing[];
  neural: NeuralFit;
};

function uniqueDates(corpus: NewsItem[]) {
  return [...new Set(corpus.map((n) => n.date))].sort();
}

function priceFor(symbol: string, date: string, book: Map<string, Listing>) {
  let h = 2166136261;
  const s = symbol + date;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0) / 4294967296;
  const base = book.get(symbol)?.startPrice ?? 80;
  return Number((base * (0.85 + 0.3 * u)).toFixed(2));
}

function nav(cash: number, positions: Position[], date: string, book: Map<string, Listing>) {
  return positions.reduce((acc, p) => acc + p.shares * priceFor(p.symbol, date, book), cash);
}

export type EngineOptions = {
  listings?: Listing[];
  seed?: number;
  locale?: "US" | "NSE";
};

export function createNewsState(
  config: StrategyConfig = DEFAULT_STRATEGY,
  options: EngineOptions = {},
): NewsState {
  const listings = options.listings ?? US_LISTINGS;
  const seed = options.seed ?? 7;
  const locale = options.locale ?? "US";
  const corpus = generateCorpus({
    listings,
    seed,
    locale,
    sources: locale === "NSE" ? NSE_SOURCES : undefined,
    buybackLabel: locale === "NSE" ? "Rs 2,000 crore" : "$8 billion",
  });
  indexCorpus(corpus);
  const dates = uniqueDates(corpus);
  const warmup = Math.min(50, dates.length - 1);
  const book = new Map(listings.map((l) => [l.symbol, l]));
  const cutoff = dates[Math.min(40, warmup)];
  const neural = trainNewsNet(
    corpus.filter((n) => n.date < cutoff),
    seed,
  );
  return simulateTo(corpus, dates, warmup, config, book, neural);
}

function simulateTo(
  corpus: NewsItem[],
  dates: string[],
  asOfIndex: number,
  config: StrategyConfig,
  book: Map<string, Listing>,
  neural: NeuralFit,
): NewsState {
  const space = indexCorpus(corpus);
  const analyzed: AnalyzedItem[] = [];
  const trades: Trade[] = [];
  let positions: Position[] = [];
  let cash = config.capital;
  const equity: EquityPoint[] = [];
  let peak = config.capital;
  const warmupDate = dates[Math.min(40, asOfIndex)];
  const listings = [...book.values()];

  for (let d = 0; d <= asOfIndex; d++) {
    const date = dates[d];
    const todays = corpus.filter((n) => n.date === date);
    const history = corpus.filter((n) => n.date < date);

    positions = positions.filter((p) => {
      if (p.exitOn > date) return true;
      const px = priceFor(p.symbol, date, book);
      cash += p.shares * px;
      trades.push({
        date,
        symbol: p.symbol,
        side: p.shares > 0 ? "sell" : "buy",
        shares: Math.abs(p.shares),
        price: px,
        headline: p.headline,
        reason: "horizon exit",
        confidence: 0,
      });
      return false;
    });

    for (const item of todays) {
      const forecast = recognize(item, history, space, config, neural.net);
      analyzed.push({ ...item, forecast });
      if (date < warmupDate) continue;
      if (forecast.side === "skip") continue;
      if (positions.some((p) => p.symbol === item.symbol)) continue;

      const px = priceFor(item.symbol, date, book);
      const equityNow = nav(cash, positions, date, book);
      const notional = equityNow * 0.08;
      const signed = forecast.side === "long" ? 1 : -1;
      const shares = Math.trunc(notional / px) * signed;
      if (shares === 0) continue;
      const cost = Math.abs(shares) * px * (config.costBps / 10_000);
      cash -= shares * px + cost;
      const exitIdx = Math.min(dates.length - 1, d + config.holdSessions);
      positions.push({
        symbol: item.symbol,
        shares,
        avgPrice: px,
        openedOn: date,
        exitOn: dates[exitIdx],
        headline: item.headline,
      });
      trades.push({
        date,
        symbol: item.symbol,
        side: shares > 0 ? "buy" : "sell",
        shares: Math.abs(shares),
        price: px,
        headline: item.headline,
        reason: `${forecast.eventLabel} · ${(forecast.confidence * 100).toFixed(0)}% conf${forecast.neuralAgree ? " · NN agree" : ""}`,
        confidence: forecast.confidence,
      });
    }

    const equityNow = nav(cash, positions, date, book);
    peak = Math.max(peak, equityNow);
    equity.push({
      date,
      equity: equityNow,
      cash,
      drawdown: peak === 0 ? 0 : equityNow / peak - 1,
    });
  }

  const tape = analyzed.filter((a) => a.date === dates[asOfIndex]);
  return {
    corpus,
    asOfIndex,
    dates,
    analyzed,
    tape,
    trades,
    positions,
    equity,
    cash,
    fingerprints: eventFingerprints(corpus.filter((n) => n.date <= dates[asOfIndex])),
    selectedId: tape[0]?.id ?? analyzed.at(-1)?.id ?? null,
    listings,
    neural,
  };
}

function bookFrom(state: NewsState) {
  return new Map(state.listings.map((l) => [l.symbol, l]));
}

export function replayConfig(state: NewsState, config: StrategyConfig): NewsState {
  return simulateTo(state.corpus, state.dates, state.asOfIndex, config, bookFrom(state), state.neural);
}

export function stepNews(state: NewsState, config: StrategyConfig): NewsState {
  if (state.asOfIndex >= state.dates.length - 1) return state;
  return simulateTo(state.corpus, state.dates, state.asOfIndex + 1, config, bookFrom(state), state.neural);
}

export function analyzeHeadline(
  headline: string,
  symbol: string,
  state: NewsState,
  config: StrategyConfig,
) {
  const date = state.dates[state.asOfIndex];
  const classification = classifyHeadline(headline);
  const space = indexCorpus(state.corpus);
  const item: NewsItem = {
    id: `paste-${Date.now()}`,
    date,
    symbol,
    headline,
    source: "You",
    classification,
    ret1d: 0,
    ret5d: 0,
    reversed: false,
    vec: vectorize(space, classification),
  };
  const history = state.corpus.filter((n) => n.date <= date);
  return { item, forecast: recognize(item, history, space, config, state.neural.net) };
}
