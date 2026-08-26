"use client";

import Image, { type StaticImageData } from "next/image";
import eurcLogo from "@/public/assets/eurc.svg";
import usdcLogo from "@/public/assets/usdc.svg";
import usdtLogo from "@/public/assets/usdt.svg";
import cirbtcLogo from "@/public/assets/cirbtc.svg";
import cngnLogo from "@/public/assets/cNGN.svg";
import qcadLogo from "@/public/assets/QCAD.svg";

const TOKEN_LOGOS: Record<string, StaticImageData> = {
  EURC: eurcLogo,
  USDC: usdcLogo,
  USDT: usdtLogo,
  CIRBTC: cirbtcLogo,
  cirBTC: cirbtcLogo,
  CNGN: cngnLogo,
  cNGN: cngnLogo,
  QCAD: qcadLogo,
};

interface TokenPairIconProps {
  token0: string;
  token1: string;
  size?: "sm" | "md";
}

export default function TokenPairIcon({
  token0,
  token1,
  size = "md",
}: TokenPairIconProps) {
  const iconSize = size === "sm" ? 18 : 22;
  // Design overlaps tokens horizontally on the same baseline (27px offset for 40px icons).
  const overlapOffset = size === "sm" ? 12 : 15;
  const containerWidth = overlapOffset + iconSize;

  const renderToken = (symbol: string, left: number, zIndex: number) => {
    const logo =
      TOKEN_LOGOS[symbol] ?? TOKEN_LOGOS[symbol.toUpperCase()];

    return (
      <span
        className="absolute top-1/2 flex -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border border-[#191A1C] bg-card"
        style={{ width: iconSize, height: iconSize, left, zIndex }}
      >
        {logo ? (
          <Image
            src={logo}
            alt={`${symbol} logo`}
            width={iconSize}
            height={iconSize}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-[8px] font-semibold text-muted-foreground">
            {symbol.slice(0, 1)}
          </span>
        )}
      </span>
    );
  };

  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: containerWidth, height: iconSize }}
    >
      {renderToken(token0, 0, 10)}
      {renderToken(token1, overlapOffset, 0)}
    </span>
  );
}
