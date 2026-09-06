import { NseSubnav } from "@/components/desk/exchange-nav";
import { InsiderTradingCaseStudy } from "@/components/desk/insider-trading-case";

export const metadata = {
  title: "Insider trading · PIT / UPSI",
  description:
    "Insider-trading event type on the NSE desk, worked through Infosys June 2021 (SEBI interim order, mild close, SAT, dismissal).",
};

export default function InsiderTradingCasePage() {
  return (
    <>
      <NseSubnav />
      <InsiderTradingCaseStudy />
    </>
  );
}
