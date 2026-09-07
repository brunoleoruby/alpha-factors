import { NSE_LISTINGS } from "../markets/nse";
import { ENV_COLUMNS, ENV_YAHOO_SYMBOLS } from "../markets/environment";
import { findSwings } from "../markets/swings";
import type { Candle } from "../markets/tv";
import { classifyHeadline } from "./classify";
import { INSIDER_LABELED } from "./cases/insider-trading";
import { TAPE_LABELED } from "./cases/tape-events";
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

const pit = classifyHeadline(
  "SEBI issues interim order in alleged insider trading; unpublished price-sensitive information leak under PIT regulations",
);
if (pit.eventType !== "insider_trading") {
  throw new Error(`expected insider_trading, got ${pit.eventType}`);
}

const sebiReview = classifyHeadline("SEBI opens review of Reliance refining practices");
if (sebiReview.eventType !== "regulation") {
  throw new Error(`expected regulation, got ${sebiReview.eventType}`);
}

if (!INSIDER_LABELED.length || INSIDER_LABELED.some((p) => p.eventType !== "insider_trading")) {
  throw new Error("expected Infosys PIT prints to classify as insider_trading");
}

const want: Record<string, string> = {
  "ADANIENT|2023-01-24": "legal",
  "ADANIENT|2023-01-27": "promoter_pledge",
  "ADANIENT|2023-02-01": "offering",
  "HDFCBANK|2020-07-31": "qip_block",
  "ZOMATO|2023-08-08": "qip_block",
  "AUROPHARMA|2023-01-18": "usfda",
  "LUPIN|2017-06-12": "usfda",
  "YESBANK|2018-09-21": "rating_cut",
  "YESBANK|2019-02-14": "rating_cut",
  "TCS|2023-10-12": "analyst_upgrade",
};
for (const row of TAPE_LABELED) {
  const expected = want[`${row.symbol}|${row.date}`];
  if (expected && row.eventType !== expected) {
    throw new Error(`${row.symbol} ${row.date}: expected ${expected}, got ${row.eventType}`);
  }
}

const fdaOk = classifyHeadline("Pfizer gets FDA approval for a new product program");
if (fdaOk.eventType !== "product") {
  throw new Error(`expected product for FDA approval, got ${fdaOk.eventType}`);
}

const street = classifyHeadline("Broker downgrades RELIANCE to underweight, price target cut");
if (street.eventType !== "analyst_downgrade") {
  throw new Error(`expected analyst_downgrade, got ${street.eventType}`);
}

const state = createNewsState(DEFAULT_STRATEGY);
if (!state.tape.length) throw new Error("expected today's tape");

const nse = createNewsState(DEFAULT_STRATEGY_NSE, { listings: NSE_LISTINGS, locale: "NSE" });
if (nse.listings.length < 50) throw new Error("expected a broad NSE book");
if (!nse.tape.length) throw new Error("expected NSE tape");

const hill: Candle[] = [
  { time: 1, open: 10, high: 10, low: 9, close: 10 },
  { time: 2, open: 10, high: 11, low: 9, close: 10 },
  { time: 3, open: 10, high: 14, low: 10, close: 12 },
  { time: 4, open: 12, high: 12, low: 9, close: 10 },
  { time: 5, open: 10, high: 11, low: 8, close: 9 },
];
const swings = findSwings(hill, 2);
if (!swings.some((s) => s.kind === "high" && s.price === 14)) {
  throw new Error("expected a swing high at 14");
}

const loud = state.analyzed.find((a) => a.forecast.sampleSize >= 3);
if (!loud) throw new Error("expected a print with historical neighbors");
if (!Number.isFinite(loud.forecast.expected1d)) throw new Error("non-finite forecast");
if (!Number.isFinite(loud.forecast.neural1d)) throw new Error("non-finite neural 1d");
if (state.neural.samples < 20) throw new Error("neural net underfit");

const next = state.asOfIndex;
if (next < 0) throw new Error("bad asOf");

if (ENV_COLUMNS.length !== 6) throw new Error("expected six environment columns");
if (new Set(ENV_COLUMNS.map((c) => c.id)).size !== 6) throw new Error("environment columns must be unique");
if (new Set(ENV_YAHOO_SYMBOLS).size !== ENV_YAHOO_SYMBOLS.length) {
  throw new Error("environment Yahoo symbols must be unique");
}

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
      neuralSamples: state.neural.samples,
      neural1d: Number(loud.forecast.neural1d.toFixed(4)),
    },
    null,
    2,
  ),
);
