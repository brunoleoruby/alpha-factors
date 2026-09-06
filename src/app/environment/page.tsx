import { UsSubnav } from "@/components/desk/exchange-nav";
import { MarketEnvironment } from "@/components/desk/market-environment";

export const metadata = {
  title: "Market environment · Varun",
  description: "Personal market-environment tab. Built later from Varun’s own read of the tape.",
};

export default function UsEnvironmentPage() {
  return (
    <>
      <UsSubnav />
      <MarketEnvironment />
    </>
  );
}
