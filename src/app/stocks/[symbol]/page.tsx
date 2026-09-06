import { notFound } from "next/navigation";
import { UsSubnav } from "@/components/desk/exchange-nav";
import { StockChartView } from "@/components/desk/stock-chart-view";
import { US_LISTINGS } from "@/lib/markets/us";
import { findListing } from "@/lib/markets/tv";

export function generateStaticParams() {
  return US_LISTINGS.map((l) => ({ symbol: l.symbol }));
}

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const listing = findListing(US_LISTINGS, symbol);
  return {
    title: listing ? `${listing.symbol} · US chart` : "US chart",
  };
}

export default async function UsStockChartPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const listing = findListing(US_LISTINGS, symbol);
  if (!listing) notFound();
  return (
    <>
      <UsSubnav />
      <StockChartView listing={listing} locale="US" backHref="/stocks" deskHref="/" />
    </>
  );
}
