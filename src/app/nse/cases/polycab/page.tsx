import { NseSubnav } from "@/components/desk/exchange-nav";
import { PolycabCaseStudy } from "@/components/desk/polycab-case";

export const metadata = {
  title: "Polycab case · Dec 2023 – Jan 2024",
  description:
    "Polycab India news from December 2023 to January 2024, classified by event, with similar prints on other NSE names and price paths.",
};

export default function PolycabCasePage() {
  return (
    <>
      <NseSubnav />
      <PolycabCaseStudy />
    </>
  );
}
