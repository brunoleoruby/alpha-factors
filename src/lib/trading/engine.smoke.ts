import { createLiveState, stepLive } from "./engine";
import { DEFAULT_STRATEGY } from "./universe";

const book = createLiveState(DEFAULT_STRATEGY);
if (!Number.isFinite(book.stats.totalReturn)) throw new Error("non-finite return");
if (book.positions.length === 0) throw new Error("expected positions after backtest");
if (book.trades.length === 0) throw new Error("expected trades");
if (book.rankings.length !== 24) throw new Error("expected full universe");

const next = stepLive(book, DEFAULT_STRATEGY);
if (next.asOfIndex !== book.asOfIndex + 1) throw new Error("live step did not advance");

console.log(
  JSON.stringify(
    {
      nav: Math.round(next.equity[next.equity.length - 1].equity),
      ret: Number(next.stats.totalReturn.toFixed(4)),
      sharpe: Number(next.stats.sharpe.toFixed(2)),
      trades: next.trades.length,
      positions: next.positions.length,
    },
    null,
    2,
  ),
);
