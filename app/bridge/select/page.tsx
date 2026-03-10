"use client";

import dynamic from "next/dynamic";

const BridgeSelectContent = dynamic(
  () => import("./bridge-select-content"),
  {
    ssr: false,
  }
);

export default function BridgeSelectPage() {
  return <BridgeSelectContent />;
}

