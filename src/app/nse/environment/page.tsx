import { NseSubnav } from "@/components/desk/exchange-nav";
import { MarketEnvironment } from "@/components/desk/market-environment";

export const metadata = {
  title: "Market environment · Varun",
  description:
    "Indian, USA, and Asia indices, plus commodity, currency, and crude oil — each in its own column.",
};

export default function NseEnvironmentPage() {
  return (
    <>
      <NseSubnav />
      <MarketEnvironment />
    </>
  );
}
