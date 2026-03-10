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
      <BridgePageContent />
    </>
  );
}
