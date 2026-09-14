import { BuyerConsole } from "@/components/buyer-console";
import { scenarios } from "@/lib/scenarios";

export default function Home() {
  return <BuyerConsole initialScenarios={scenarios} />;
}
