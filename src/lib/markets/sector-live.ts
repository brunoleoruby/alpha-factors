import type { SectorMarket } from "./sector-returns";

export type SectorSleeve = "cyclical" | "defensive";

export type LiveSector = {
  sector: string;
  yahoo: string[];
  sleeve: SectorSleeve;
};

export type LiveUniverse = {
  market: SectorMarket;
  benchmark: string[];
  vix: string[];
  sectors: LiveSector[];
};

export const US_LIVE_UNIVERSE: LiveUniverse = {
  market: "US",
  benchmark: ["^GSPC", "SPY"],
  vix: ["^VIX"],
  sectors: [
    { sector: "Energy", yahoo: ["XLE"], sleeve: "cyclical" },
    { sector: "Technology", yahoo: ["XLK"], sleeve: "cyclical" },
    { sector: "Communication", yahoo: ["XLC"], sleeve: "cyclical" },
    { sector: "Financials", yahoo: ["XLF"], sleeve: "cyclical" },
    { sector: "Consumer disc.", yahoo: ["XLY"], sleeve: "cyclical" },
    { sector: "Industrials", yahoo: ["XLI"], sleeve: "cyclical" },
    { sector: "Health", yahoo: ["XLV"], sleeve: "defensive" },
    { sector: "Utilities", yahoo: ["XLU"], sleeve: "defensive" },
    { sector: "Materials", yahoo: ["XLB"], sleeve: "cyclical" },
    { sector: "Real estate", yahoo: ["XLRE"], sleeve: "cyclical" },
    { sector: "Consumer staples", yahoo: ["XLP"], sleeve: "defensive" },
  ],
};

export const NSE_LIVE_UNIVERSE: LiveUniverse = {
  market: "NSE",
  benchmark: ["^NSEI", "NIFTY_50.NS"],
  vix: ["^INDIAVIX"],
  sectors: [
    { sector: "Bank", yahoo: ["^NSEBANK", "NIFTY_BANK.NS"], sleeve: "cyclical" },
    { sector: "Auto", yahoo: ["^CNXAUTO", "NIFTY_AUTO.NS"], sleeve: "cyclical" },
    { sector: "Metal", yahoo: ["^CNXMETAL", "NIFTY_METAL.NS"], sleeve: "cyclical" },
    { sector: "IT", yahoo: ["^CNXIT", "NIFTY_IT.NS"], sleeve: "defensive" },
    { sector: "Pharma", yahoo: ["^CNXPHARMA", "NIFTY_PHARMA.NS"], sleeve: "defensive" },
    { sector: "FMCG", yahoo: ["^CNXFMCG", "NIFTY_FMCG.NS"], sleeve: "defensive" },
    { sector: "Energy", yahoo: ["^CNXENERGY", "NIFTY_ENERGY.NS"], sleeve: "cyclical" },
    { sector: "Realty", yahoo: ["^CNXREALTY", "NIFTY_REALTY.NS"], sleeve: "cyclical" },
    { sector: "Infra", yahoo: ["^CNXINFRA", "NIFTY_INFRA.NS"], sleeve: "cyclical" },
    { sector: "PSU Bank", yahoo: ["^CNXPSUBANK", "NIFTY_PSU_BANK.NS"], sleeve: "cyclical" },
    { sector: "Media", yahoo: ["^CNXMEDIA", "NIFTY_MEDIA.NS"], sleeve: "cyclical" },
    { sector: "Telecom", yahoo: ["BHARTIARTL.NS"], sleeve: "defensive" },
  ],
};

export function liveUniverse(market: SectorMarket): LiveUniverse {
  return market === "NSE" ? NSE_LIVE_UNIVERSE : US_LIVE_UNIVERSE;
}

export function yahooAllowlist() {
  const names = new Set<string>();
  for (const book of [US_LIVE_UNIVERSE, NSE_LIVE_UNIVERSE]) {
    for (const y of [...book.benchmark, ...book.vix, ...book.sectors.flatMap((s) => s.yahoo)]) {
      names.add(y);
    }
  }
  return names;
}
