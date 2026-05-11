"use client";

import Image, { type StaticImageData } from "next/image";
import { motion } from "framer-motion";
import { Info } from "lucide-react";

import quotesIcon from "@/public/assets/quotes icon.svg";
import synthraLogo from "@/public/assets/synthralogo.svg";
import xylonetLogo from "@/public/assets/xylonetlogo.svg";

interface RouteOption {
  dexId: string;
  dexName: string;
  outputAmount: string;
  routeType: string;
}

interface RouterDisplayProps {
  selectedRouterId?: string;
  routeOptions?: RouteOption[];
  isAutoSelected?: boolean;
}

type SupportedRouter = {
  id: "xylonet-adapter" | "synthra";
  aliases: string[];
  name: string;
  logo: StaticImageData | string;
};

const SUPPORTED_ROUTERS: SupportedRouter[] = [
  {
    id: "xylonet-adapter",
    aliases: ["xylonet", "xylonet-adapter"],
    name: "XyloNet",
    logo: xylonetLogo,
  },
  {
    id: "synthra",
    aliases: ["synthra", "synthra-v3"],
    name: "Synthra",
    logo: synthraLogo,
  },
];

const normalizeRouterId = (id = "") => {
  const normalizedId = id.toLowerCase();

  return (
    SUPPORTED_ROUTERS.find((router) => router.aliases.includes(normalizedId))
      ?.id || normalizedId
  );
};

const outputAmountToBigInt = (amount?: string) => {
  try {
    return BigInt(amount || "0");
  } catch {
    return 0n;
  }
};

const formatQuoteAmount = (amount?: string) => {
  const rawAmount = outputAmountToBigInt(amount);

  if (rawAmount <= 0n) {
    return "-";
  }

  const whole = rawAmount / 10n ** 18n;
  const fraction = rawAmount % 10n ** 18n;
  const cents = (fraction * 100n) / 10n ** 18n;

  return `$${whole.toString()}.${cents.toString().padStart(2, "0")}`;
};

export default function RouterDisplay({
  selectedRouterId,
  routeOptions = [],
}: RouterDisplayProps) {
  const routeOptionByDexId = routeOptions.reduce((optionsByDexId, option) => {
    const dexId = normalizeRouterId(option.dexId);
    const existingOption = optionsByDexId.get(dexId);

    if (
      !existingOption ||
      outputAmountToBigInt(option.outputAmount) >
        outputAmountToBigInt(existingOption.outputAmount)
    ) {
      optionsByDexId.set(dexId, option);
    }

    return optionsByDexId;
  }, new Map<string, RouteOption>());

  const bestOutputAmount = SUPPORTED_ROUTERS.reduce((bestAmount, router) => {
    const option = routeOptionByDexId.get(router.id);
    const outputAmount = outputAmountToBigInt(option?.outputAmount);

    return outputAmount > bestAmount ? outputAmount : bestAmount;
  }, 0n);
  const sortedRouters = [...SUPPORTED_ROUTERS].sort(
    (leftRouter, rightRouter) => {
      const leftOutputAmount = outputAmountToBigInt(
        routeOptionByDexId.get(leftRouter.id)?.outputAmount,
      );
      const rightOutputAmount = outputAmountToBigInt(
        routeOptionByDexId.get(rightRouter.id)?.outputAmount,
      );

      if (leftOutputAmount === rightOutputAmount) {
        return 0;
      }

      return leftOutputAmount > rightOutputAmount ? -1 : 1;
    },
  );
  const normalizedSelectedRouterId = selectedRouterId
    ? normalizeRouterId(selectedRouterId)
    : undefined;
  const dexCount = SUPPORTED_ROUTERS.length;

  return (
    <section className="relative w-full overflow-visible rounded-2xl border border-[#24282e] bg-[#111315] shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#20242a] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Image
            src={quotesIcon}
            alt=""
            width={16}
            height={16}
            aria-hidden
            className="h-4 w-4 shrink-0 object-contain"
          />
          <span className="text-sm font-semibold text-white">Quotes</span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="inline-grid h-3.5 min-w-6 shrink-0 place-items-center rounded-full px-1 text-white"
            style={{
              backgroundColor: "#2E2E2E",
            }}
            aria-label={`${dexCount} DEX routes available`}
          >
            <span className="block translate-y-[0.5px] text-[9px] font-bold leading-none">
              {dexCount}
            </span>
          </span>
          <span className="truncate text-[11px] font-medium text-white/80">
            <span className="text-[9px] font-normal text-white/45">Via</span>{" "}
            <span>XyloNet & Synthra</span>
          </span>
          <span className="group relative flex h-4 w-4 shrink-0 items-center justify-center">
            <Info
              className="h-3.5 w-3.5 text-white/70"
              tabIndex={0}
              aria-describedby="router-quotes-info"
            />
            <span
              id="router-quotes-info"
              role="tooltip"
              className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg border border-white/10 bg-[#08090a] px-3 py-2 text-left text-[11px] font-normal leading-4 text-white/80 opacity-0 shadow-[0_16px_32px_rgba(0,0,0,0.45)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              Quotes from major routers on Tower are simulated on the same block
              to find the best executable prices.
            </span>
          </span>
        </div>
      </div>

      <div className="space-y-1 p-1.5">
        {sortedRouters.map((router) => {
          const option = routeOptionByDexId.get(router.id);
          const outputAmount = outputAmountToBigInt(option?.outputAmount);
          const isBestPrice =
            outputAmount > 0n && outputAmount === bestOutputAmount;
          const isSelected =
            normalizedSelectedRouterId === router.id ||
            (!normalizedSelectedRouterId && isBestPrice);
          const isAvailable = Boolean(option);

          return (
            <motion.div
              key={router.id}
              role="listitem"
              className={`flex h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left transition-colors ${
                isSelected
                  ? "border border-[#35404a] bg-[#161a20]"
                  : "border border-transparent"
              } ${isAvailable ? "" : "opacity-45"}`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Image
                  src={router.logo}
                  alt={`${router.name} logo`}
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] shrink-0 object-contain"
                />
                <span className="truncate text-sm font-medium text-white/90">
                  {router.name}
                </span>
                {isBestPrice && (
                  <span className="rounded-md bg-[#213242] px-1.5 py-0.5 text-[9px] font-medium text-[#8fbce7]">
                    Best Price
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-white/90">
                {isAvailable
                  ? formatQuoteAmount(option?.outputAmount)
                  : "Unavailable"}
              </span>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
