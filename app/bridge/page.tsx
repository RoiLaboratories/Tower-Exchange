"use client";

import dynamic from "next/dynamic";
import TokenTicker from "@/components/TokenTicker";
import PromotionalSidebar from "@/components/PromotionalSidebar";

const BridgePageContent = dynamic(() => import("./bridge-content"), {
  ssr: false,
});

export default function BridgePage() {
  return (
    <>
      <TokenTicker />
      <main className="flex-1 flex flex-col items-center justify-center py-12 px-4 gap-8">
        <div className="w-full max-w-md">
          <BridgePageContent />
        </div>
        <div className="w-full max-w-md">
          <PromotionalSidebar />
        </div>
      </main>
    </>
  );
}
