import { NseSubnav } from "@/components/desk/exchange-nav";
import { TapeEventsCaseStudy } from "@/components/desk/tape-events-case";

export const metadata = {
  title: "Pledge · QIP · USFDA · Rating",
  description:
    "NSE event types for promoter pledge, QIP/block deals, USFDA 483s, and credit-rating cuts, with worked prints.",
};

export default function TapeEventsCasePage() {
  return (
    <>
      <NseSubnav />
      <TapeEventsCaseStudy />
    </>
  );
}
