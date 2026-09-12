import { liveUniverse } from "./sector-live";
import { fetchFirstSeries } from "./sector-quotes";
import { buildLiveBook, lookbackReturn, skipMonthSixReturn, YEAR_DAYS, type LiveBook } from "./sector-signals";
import type { SectorMarket } from "./sector-returns";

export type LiveSignals = LiveBook & {
  market: SectorMarket;
  asOf: string;
  live: number;
  total: number;
  benchmark: string;
  vixYahoo: string;
};

export async function computeLiveSignals(market: SectorMarket): Promise<LiveSignals> {
  const universe = liveUniverse(market);
  const [bench, vixSeries, ...seriesList] = await Promise.all([
    fetchFirstSeries(universe.benchmark),
    fetchFirstSeries(universe.vix),
    ...universe.sectors.map((s) => fetchFirstSeries(s.yahoo)),
  ]);

  const absMom = bench ? lookbackReturn(bench.closes, YEAR_DAYS) : null;
  const vix = vixSeries?.last ?? vixSeries?.closes.at(-1) ?? null;
  const rows = universe.sectors.map((sector, i) => {
    const series = seriesList[i];
    return {
      sector: sector.sector,
      yahoo: series?.yahoo ?? sector.yahoo[0],
      sleeve: sector.sleeve,
      mom6: series ? skipMonthSixReturn(series.closes) : null,
      mom12: series ? lookbackReturn(series.closes, YEAR_DAYS) : null,
    };
  });
  const book = buildLiveBook(rows, absMom, vix);
  return {
    market,
    asOf: new Date().toISOString(),
    live: rows.filter((r) => r.mom6 != null).length,
    total: rows.length,
    benchmark: bench?.yahoo ?? universe.benchmark[0],
    vixYahoo: vixSeries?.yahoo ?? universe.vix[0],
    ...book,
  };
}
