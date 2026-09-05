import { classifyHeadline } from "./classify";
import { generateCorpus, type NewsItem } from "./corpus";
import { eventFingerprints, indexCorpus, recognize, type BehaviorForecast } from "./patterns";
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
};

function uniqueDates(corpus: NewsItem[]) {
  return [...new Set(corpus.map((n) => n.date))].sort();
}

function priceFor(symbol: string, date: string) {
  let h = 2166136261;
  const s = symbol + date;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0) / 4294967296;
  const base: Record<string, number> = {
    NVDA: 120,
    AAPL: 220,
    MSFT: 410,
    AMZN: 180,
    GOOGL: 165,
    META: 500,
    TSLA: 240,
    JPM: 200,
    XOM: 110,
    UNH: 520,
    PFE: 27,
    BA: 175,
    DIS: 95,
    NFLX: 700,
    INTC: 22,
    AMD: 140,
  };
  return Number(((base[symbol] ?? 80) * (0.85 + 0.3 * u)).toFixed(2));
}

function nav(cash: number, positions: Position[], date: string) {
  return positions.reduce((acc, p) => acc + p.shares * priceFor(p.symbol, date), cash);
}

export function createNewsState(config: StrategyConfig = DEFAULT_STRATEGY, seed = 7): NewsState {
  const corpus = generateCorpus(seed, 180);
  indexCorpus(corpus);
  const dates = uniqueDates(corpus);
  const warmup = Math.min(50, dates.length - 1);
  return simulateTo(corpus, dates, warmup, config);
}

function simulateTo(
  corpus: NewsItem[],
  dates: string[],
  asOfIndex: number,
  config: StrategyConfig,
): NewsState {
  const space = indexCorpus(corpus);
  const analyzed: AnalyzedItem[] = [];
  const trades: Trade[] = [];
  let positions: Position[] = [];
  let cash = config.capital;
  const equity: EquityPoint[] = [];
  let peak = config.capital;
  const warmupDate = dates[Math.min(40, asOfIndex)];

  for (let d = 0; d <= asOfIndex; d++) {
    const date = dates[d];
    const todays = corpus.filter((n) => n.date === date);
    const history = corpus.filter((n) => n.date < date);

    positions = positions.filter((p) => {
      if (p.exitOn > date) return true;
      const px = priceFor(p.symbol, date);
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
      const forecast = recognize(item, history, space, config);
      analyzed.push({ ...item, forecast });
      if (date < warmupDate) continue;
      if (forecast.side === "skip") continue;
      if (positions.some((p) => p.symbol === item.symbol)) continue;

      const px = priceFor(item.symbol, date);
      const equityNow = nav(cash, positions, date);
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
        reason: `${forecast.eventLabel} · ${(forecast.confidence * 100).toFixed(0)}% conf`,
        confidence: forecast.confidence,
      });
    }

    const equityNow = nav(cash, positions, date);
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
  };
}

export function replayConfig(state: NewsState, config: StrategyConfig): NewsState {
  return simulateTo(state.corpus, state.dates, state.asOfIndex, config);
}

export function stepNews(state: NewsState, config: StrategyConfig): NewsState {
  if (state.asOfIndex >= state.dates.length - 1) return state;
  return simulateTo(state.corpus, state.dates, state.asOfIndex + 1, config);
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
  return { item, forecast: recognize(item, history, space, config) };
}
