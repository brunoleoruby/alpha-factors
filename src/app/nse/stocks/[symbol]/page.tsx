import { notFound } from "next/navigation";
import { NseSubnav } from "@/components/desk/exchange-nav";
import { StockChartView } from "@/components/desk/stock-chart-view";
import { NSE_LISTINGS } from "@/lib/markets/nse";
import { findListing } from "@/lib/markets/tv";

export function generateStaticParams() {
  return NSE_LISTINGS.map((l) => ({ symbol: l.symbol }));
}

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const listing = findListing(NSE_LISTINGS, symbol);
  return {
    title: listing ? `${listing.symbol} · NSE chart` : "NSE chart",
  };
}

export default async function NseStockChartPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const listing = findListing(NSE_LISTINGS, symbol);
  if (!listing) notFound();
  return (
    <>
      <NseSubnav />
      <StockChartView listing={listing} locale="NSE" backHref="/nse/stocks" deskHref="/nse" />
    </>
  );
}
