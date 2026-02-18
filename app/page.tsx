import SwapCard from "@/components/SwapCard";
import TokenTicker from "@/components/TokenTicker";

export default function Home() {
  return (
    <>
      <TokenTicker />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <SwapCard />
      </main>
    </>
  );
}
