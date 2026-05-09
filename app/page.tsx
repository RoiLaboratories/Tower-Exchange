"use client";
import { useState } from "react";
import SwapCard from "@/components/SwapCard";
import TokenTicker from "@/components/TokenTicker";
import dynamic from "next/dynamic";

const BridgeCardContent = dynamic(() => import("@/app/bridge/bridge-content"), {
  ssr: false,
});

export default function Home() {
  const [currentView, setCurrentView] = useState<"swap" | "bridge">("swap");

  return (
    <>
      <TokenTicker />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        {currentView === "swap" ? (
          <div className="w-full max-w-[62rem]">
            <SwapCard onNavigateToBridge={() => setCurrentView("bridge")} />
          </div>
        ) : (
          <div className="w-full max-w-md">
            <BridgeCardContent
              onNavigateToSwap={() => setCurrentView("swap")}
            />
          </div>
        )}
      </main>
    </>
  );
}
