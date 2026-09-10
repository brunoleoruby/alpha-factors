import { FundDashboard } from "@/components/desk/fund-dashboard";
import { UsSubnav } from "@/components/desk/exchange-nav";

export default function Home() {
  return (
    <>
      <UsSubnav />
      <main className="flex flex-1 flex-col">
        <FundDashboard />
      </main>
    </>
  );
}
