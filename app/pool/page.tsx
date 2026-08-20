"use client";

import TokenTicker from "@/components/TokenTicker";
import ComingSoonModal from "@/components/ComingSoonModal";

export default function PoolPage() {
  return (
    <>
      <TokenTicker />
      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12" />
      <ComingSoonModal
        isOpen
        feature="Pool"
        title="Pools Are Coming Soon"
        description="Tower liquidity pools are in development. Soon you'll be able to add liquidity, earn fees, and manage positions all in one place."
        ctaLabel="Explore Swap"
        ctaPath="/"
      />
    </>
  );
}
