"use client";

import dynamic from "next/dynamic";

const BridgePageContent = dynamic(() => import("./bridge-content"), {
  ssr: false,
});

export default function BridgePage() {
  return <BridgePageContent />;
}
