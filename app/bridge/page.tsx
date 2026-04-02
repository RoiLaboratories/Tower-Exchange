"use client";

import dynamic from "next/dynamic";
import TokenTicker from "@/components/TokenTicker";

const BridgePageContent = dynamic(() => import("./bridge-content"), {
  ssr: false,
});

export default function BridgePage() {
  return (
    <>
      <TokenTicker />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <BridgePageContent />
        </div>
      </main>
    </>
  );
}
