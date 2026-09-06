import { NSE_LISTINGS } from "../markets/nse";
import { classifyHeadline } from "./classify";
import { createNewsState } from "./engine";
import { DEFAULT_STRATEGY, DEFAULT_STRATEGY_NSE } from "./taxonomy";

const beat = classifyHeadline("NVIDIA beats quarterly estimates as AI chips demand stays firm");
if (beat.eventType !== "earnings_beat") {
  throw new Error(`expected earnings_beat, got ${beat.eventType}`);
}

const miss = classifyHeadline("Apple misses estimates as iPhone weakness hits results");
if (miss.eventType !== "earnings_miss") {
  throw new Error(`expected earnings_miss, got ${miss.eventType}`);
}

const cut = classifyHeadline("Microsoft cuts guidance on softer cloud trends");
if (cut.eventType !== "guidance_cut") {
  throw new Error(`expected guidance_cut, got ${cut.eventType}`);
}

const state = createNewsState(DEFAULT_STRATEGY);
if (!state.tape.length) throw new Error("expected today's tape");

const nse = createNewsState(DEFAULT_STRATEGY_NSE, { listings: NSE_LISTINGS, locale: "NSE" });
if (nse.listings.length < 50) throw new Error("expected a broad NSE book");
if (!nse.tape.length) throw new Error("expected NSE tape");

const loud = state.analyzed.find((a) => a.forecast.sampleSize >= 3);
if (!loud) throw new Error("expected a print with historical neighbors");
if (!Number.isFinite(loud.forecast.expected1d)) throw new Error("non-finite forecast");

const next = state.asOfIndex;
if (next < 0) throw new Error("bad asOf");

console.log(
  JSON.stringify(
    {
      event: beat.eventType,
      tape: state.tape.length,
      neighbors: loud.forecast.sampleSize,
      nav: Math.round(state.equity.at(-1)?.equity ?? 0),
      tickets: state.trades.length,
      fingerprints: state.fingerprints.length,
      nseNames: nse.listings.length,
    },
    null,
    2,
  ),
);
