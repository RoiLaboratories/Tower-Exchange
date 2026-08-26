"use client";

import Image from "next/image";
import Link from "next/link";
import editIcon from "@/public/assets/edit_icon.svg";
import {
  buildNewPositionStep1Path,
  formatPoolFeeLabel,
  formatPoolPairLabel,
  type NewPositionSelection,
} from "@/lib/pool/newPosition";
import type { SwapTokenSymbol } from "@/lib/swapTokens";
import { getTokenIcon } from "@/lib/tokenIcons";

const TOKEN_SIZE = 26;
const TOKEN_OVERLAP = 11;

function tokenCircleColor(token: SwapTokenSymbol) {
  if (token === "EURC") {
    return "#0B53BF";
  }

  return "#3E73C4";
}

function HeaderTokenPairIcon({
  token0,
  token1,
}: {
  token0: SwapTokenSymbol;
  token1: SwapTokenSymbol;
}) {
  const renderToken = (
    token: SwapTokenSymbol,
    left: number,
    zIndex: number,
  ) => {
    const icon = getTokenIcon(token);

    return (
      <span
        className="absolute top-1/2 inline-flex -translate-y-1/2 items-center justify-center overflow-hidden rounded-full ring-2 ring-[#191A1C]"
        style={{
          width: TOKEN_SIZE,
          height: TOKEN_SIZE,
          left,
          zIndex,
          backgroundColor: tokenCircleColor(token),
        }}
      >
        {icon ? (
          <Image
            src={icon}
            alt=""
            width={TOKEN_SIZE}
            height={TOKEN_SIZE}
            className="h-full w-full object-cover"
            aria-hidden
          />
        ) : null}
      </span>
    );
  };

  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: TOKEN_SIZE + TOKEN_OVERLAP, height: TOKEN_SIZE }}
    >
      {renderToken(token0, 0, 1)}
      {renderToken(token1, TOKEN_OVERLAP, 2)}
    </span>
  );
}

interface NewPositionStep2CardHeaderProps {
  selection: NewPositionSelection;
}

export default function NewPositionStep2CardHeader({
  selection,
}: NewPositionStep2CardHeaderProps) {
  const pairLabel = formatPoolPairLabel(selection.token0, selection.token1);
  const feeLabel = formatPoolFeeLabel(selection.fee);

  return (
    <div className="px-4 pt-4 pb-3">
      <div className="flex min-h-[52px] items-center justify-between gap-3 rounded-[20px] border border-border/60 bg-secondary/15 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <HeaderTokenPairIcon
            token0={selection.token0}
            token1={selection.token1}
          />
          <span className="truncate text-sm font-medium text-foreground">
            {pairLabel}
          </span>
          <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-light text-muted-foreground">
            {feeLabel}
          </span>
        </div>

        <Link
          href={buildNewPositionStep1Path(selection)}
          className="inline-flex shrink-0 transition-opacity hover:opacity-90"
          aria-label="Edit position pair"
        >
          <Image
            src={editIcon}
            alt="Edit"
            width={82}
            height={28}
            className="h-6 w-[70px]"
          />
        </Link>
      </div>
    </div>
  );
}
