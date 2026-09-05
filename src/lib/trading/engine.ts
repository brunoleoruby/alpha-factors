import { scoreUniverse, targetBook } from "./factors";
import { appendBar, generateMarket } from "./market";
import { cagr, maxDrawdown, sharpe, std } from "./stats";
import type {
  BacktestResult,
  EquityPoint,
  LiveState,
  Market,
  PerformanceStats,
  Position,
  StrategyConfig,
  Trade,
} from "./types";
import { UNIVERSE } from "./universe";

const WARMUP = 63;

function markPositions(
  holdings: Record<string, { shares: number; avgPrice: number }>,
  market: Market,
  asOfIndex: number,
  equity: number,
): Position[] {
  return Object.entries(holdings)
    .filter(([, h]) => Math.abs(h.shares) > 1e-8)
    .map(([symbol, h]) => {
      const price = market.series[symbol][asOfIndex].close;
      const marketValue = h.shares * price;
      return {
        symbol,
        shares: h.shares,
        avgPrice: h.avgPrice,
        marketValue,
        weight: equity === 0 ? 0 : marketValue / equity,
        unrealizedPnl: h.shares * (price - h.avgPrice),
      };
    })
    .sort((a, b) => Math.abs(b.marketValue) - Math.abs(a.marketValue));
}

function nav(
  cash: number,
  holdings: Record<string, { shares: number; avgPrice: number }>,
  market: Market,
  asOfIndex: number,
) {
  let equity = cash;
  for (const [symbol, h] of Object.entries(holdings)) {
    equity += h.shares * market.series[symbol][asOfIndex].close;
  }
  return equity;
}

function performance(equity: EquityPoint[], tradeCount: number, positions: Position[]): PerformanceStats {
  const values = equity.map((e) => e.equity);
  const daily: number[] = [];
  for (let i = 1; i < values.length; i++) {
    daily.push(values[i] / values[i - 1] - 1);
  }
  const start = values[0] ?? 0;
  const end = values[values.length - 1] ?? 0;
  const longExposure = positions.filter((p) => p.shares > 0).reduce((a, p) => a + p.weight, 0);
  const shortExposure = positions.filter((p) => p.shares < 0).reduce((a, p) => a + p.weight, 0);
  return {
    totalReturn: start === 0 ? 0 : end / start - 1,
    cagr: cagr(start, end, Math.max(1, values.length - 1)),
    volatility: daily.length ? std(daily) * Math.sqrt(252) : 0,
    sharpe: sharpe(daily),
    maxDrawdown: maxDrawdown(values),
    tradeCount,
    longExposure,
    shortExposure,
  };
}

function rebalance(
  state: {
    cash: number;
    holdings: Record<string, { shares: number; avgPrice: number }>;
    trades: Trade[];
  },
  market: Market,
  asOfIndex: number,
  config: StrategyConfig,
) {
  const rankings = scoreUniverse(market, asOfIndex, config.weights);
  const targets = targetBook(rankings, config.longCount, config.shortCount);
  const equity = nav(state.cash, state.holdings, market, asOfIndex);
  const desired = new Map(targets.map((t) => [t.symbol, t]));
  const symbols = new Set([...Object.keys(state.holdings), ...desired.keys()]);
  const date = market.dates[asOfIndex];
  const costRate = config.costBps / 10_000;

  for (const symbol of symbols) {
    const price = market.series[symbol][asOfIndex].close;
    const current = state.holdings[symbol]?.shares ?? 0;
    const targetWeight = desired.get(symbol)?.weight ?? 0;
    const targetShares = Math.trunc((targetWeight * equity) / price);
    const delta = targetShares - current;
    if (delta === 0) continue;

    const notional = Math.abs(delta) * price;
    const cost = notional * costRate;
    state.cash -= delta * price + cost;
    const nextShares = current + delta;
    if (Math.abs(nextShares) < 1e-8) {
      delete state.holdings[symbol];
    } else {
      const prev = state.holdings[symbol] ?? { shares: 0, avgPrice: price };
      let avgPrice = prev.avgPrice;
      if (Math.sign(prev.shares) === Math.sign(nextShares) || prev.shares === 0) {
        const added = Math.abs(nextShares) > Math.abs(prev.shares);
        if (added) {
          const addedShares = nextShares - prev.shares;
          avgPrice =
            (Math.abs(prev.shares) * prev.avgPrice + Math.abs(addedShares) * price) /
            Math.abs(nextShares);
        }
      } else {
        avgPrice = price;
      }
      state.holdings[symbol] = { shares: nextShares, avgPrice };
    }

    state.trades.push({
      date,
      symbol,
      side: delta > 0 ? "buy" : "sell",
      shares: Math.abs(delta),
      price,
      notional,
      cost,
      reason: current === 0 ? "open" : "rebalance",
    });
  }

  return { rankings, targets };
}

function snapshotEquity(
  date: string,
  equity: number,
  cash: number,
  peak: { value: number },
): EquityPoint {
  peak.value = Math.max(peak.value, equity);
  return {
    date,
    equity,
    cash,
    drawdown: peak.value === 0 ? 0 : equity / peak.value - 1,
  };
}

export function runBacktest(config: StrategyConfig, seed = 42, bars = 260): BacktestResult {
  const market = generateMarket(seed, bars);
  const live = createLiveState(config, market);
  return toBacktest(live);
}

export function createLiveState(config: StrategyConfig, market?: Market, seed = 42): LiveState {
  const book = market ?? generateMarket(seed, 260);
  return simulateThrough(config, book, book.dates.length - 1);
}

function simulateThrough(config: StrategyConfig, market: Market, endIndex: number): LiveState {
  const bag = {
    cash: config.capital,
    holdings: {} as Record<string, { shares: number; avgPrice: number }>,
    trades: [] as Trade[],
  };
  const equityCurve: EquityPoint[] = [];
  const peak = { value: config.capital };
  let lastRebalanceIndex = -1;
  let rankings = scoreUniverse(market, Math.min(WARMUP, endIndex), config.weights);
  let targets = targetBook(rankings, config.longCount, config.shortCount);

  const start = Math.min(WARMUP, endIndex);
  for (let i = start; i <= endIndex; i++) {
    const due = lastRebalanceIndex < 0 || i - lastRebalanceIndex >= config.rebalanceEvery;
    if (due) {
      const result = rebalance(bag, market, i, config);
      rankings = result.rankings;
      targets = result.targets;
      lastRebalanceIndex = i;
    }
    const equity = nav(bag.cash, bag.holdings, market, i);
    equityCurve.push(snapshotEquity(market.dates[i], equity, bag.cash, peak));
  }

  const last = equityCurve[equityCurve.length - 1]?.equity ?? config.capital;
  const positions = markPositions(bag.holdings, market, endIndex, last);
  return {
    market,
    asOfIndex: endIndex,
    cash: bag.cash,
    holdings: bag.holdings,
    trades: bag.trades,
    equity: equityCurve,
    lastRebalanceIndex,
    rankings,
    targets,
    positions,
    stats: performance(equityCurve, bag.trades.length, positions),
  };
}

export function toBacktest(state: LiveState): BacktestResult {
  return {
    equity: state.equity,
    trades: state.trades,
    positions: state.positions,
    rankings: state.rankings,
    targets: state.targets,
    lastDate: state.market.dates[state.asOfIndex],
    asOfIndex: state.asOfIndex,
    stats: state.stats,
  };
}

export function stepLive(state: LiveState, config: StrategyConfig, seed = 42): LiveState {
  const market = appendBar(state.market, seed);
  return continueFrom(state, market, config);
}

function continueFrom(prev: LiveState, market: Market, config: StrategyConfig): LiveState {
  const i = market.dates.length - 1;
  const bag = {
    cash: prev.cash,
    holdings: { ...prev.holdings },
    trades: [...prev.trades],
  };
  // copy nested holdings
  bag.holdings = Object.fromEntries(
    Object.entries(prev.holdings).map(([k, v]) => [k, { ...v }]),
  );

  let lastRebalanceIndex = prev.lastRebalanceIndex;
  let rankings = prev.rankings;
  let targets = prev.targets;
  const due = lastRebalanceIndex < 0 || i - lastRebalanceIndex >= config.rebalanceEvery;
  if (due) {
    const result = rebalance(bag, market, i, config);
    rankings = result.rankings;
    targets = result.targets;
    lastRebalanceIndex = i;
  } else {
    rankings = scoreUniverse(market, i, config.weights);
    targets = targetBook(rankings, config.longCount, config.shortCount);
  }

  const peak = {
    value: Math.max(...prev.equity.map((e) => e.equity), bag.cash),
  };
  const equityValue = nav(bag.cash, bag.holdings, market, i);
  const point = snapshotEquity(market.dates[i], equityValue, bag.cash, peak);
  const equity = [...prev.equity, point];
  const positions = markPositions(bag.holdings, market, i, equityValue);

  return {
    market,
    asOfIndex: i,
    cash: bag.cash,
    holdings: bag.holdings,
    trades: bag.trades,
    equity,
    lastRebalanceIndex,
    rankings,
    targets,
    positions,
    stats: performance(equity, bag.trades.length, positions),
  };
}

export function replayConfig(config: StrategyConfig, market: Market): LiveState {
  return simulateThrough(config, market, market.dates.length - 1);
}

export function symbols() {
  return UNIVERSE.map((n) => n.symbol);
}
