"use client";

import Image, { type StaticImageData } from "next/image";
import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { formatUnits } from "viem";

import { formatUsdAmount } from "@/lib/formatUsdAmount";
import quotesIcon from "@/public/assets/quotes icon.svg";
import synthraLogo from "@/public/assets/synthralogo.svg";
import towerLogo from "@/public/assets/Tower Logo.svg";
import unitflowLogo from "@/public/assets/unitflow.svg";
import xylonetLogo from "@/public/assets/xylonetlogo.svg";
import routeIcon from "@/public/assets/route icon.svg";

interface RouteOption {
  dexId: string;
  dexName: string;
  outputAmount: string;
  routeType: string;
}

interface RouterDisplayProps {
  selectedRouterId?: string;
  routeOptions?: RouteOption[];
  outputTokenUsdPrice?: number;
  outputTokenSymbol?: string;
  availableRouterIds?: string[];
}

type SupportedRouter = {
  id: "xylonet-adapter" | "synthra" | "unitflow" | "tower-dex";
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
  {
    id: "unitflow",
    aliases: ["unitflow", "unitflow-v3", "unitflow-finance"],
    name: "UnitFlow",
    logo: unitflowLogo,
  },
  {
    id: "tower-dex",
    aliases: ["tower-dex", "tower-amm", "tower"],
    name: "Tower",
    logo: towerLogo,
  },
];

const ROUTE_OUTPUT_DISPLAY_DECIMALS: Partial<Record<string, number>> = {
  cirBTC: 8,
};

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

const formatRouteTokenAmount = (amount?: string, outputTokenSymbol?: string) => {
  const rawAmount = outputAmountToBigInt(amount);

  if (rawAmount <= 0n) {
    return "-";
  }

  const tokenAmount = Number.parseFloat(formatUnits(rawAmount, 18));
  if (!Number.isFinite(tokenAmount)) {
    return "-";
  }

  const maximumFractionDigits =
    ROUTE_OUTPUT_DISPLAY_DECIMALS[outputTokenSymbol || ""] ?? 6;
  const formattedAmount = tokenAmount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });

  return formattedAmount;
};

const formatRouteUsdValue = (amount?: string, outputTokenUsdPrice?: number) => {
  const rawAmount = outputAmountToBigInt(amount);

  if (rawAmount <= 0n) {
    return null;
  }

  if (typeof outputTokenUsdPrice !== "number" || outputTokenUsdPrice <= 0) {
    return null;
  }

  const tokenAmount = Number.parseFloat(formatUnits(rawAmount, 18));
  if (!Number.isFinite(tokenAmount)) {
    return null;
  }

  return formatUsdAmount(tokenAmount, outputTokenUsdPrice);
};

export default function RouterDisplay({
  selectedRouterId,
  routeOptions = [],
  outputTokenUsdPrice,
  outputTokenSymbol,
  availableRouterIds = [],
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

  const normalizedAvailableRouterIds = Array.from(
    new Set(availableRouterIds.map((routerId) => normalizeRouterId(routerId))),
  );
  const availableRouterIdSet = new Set(normalizedAvailableRouterIds);
  const routersToDisplay = (
    normalizedAvailableRouterIds.length > 0
      ? SUPPORTED_ROUTERS.filter((router) => availableRouterIdSet.has(router.id))
      : SUPPORTED_ROUTERS.filter((router) => routeOptionByDexId.has(router.id))
  ).map((router, index) => ({ router, index }));

  const displayedRoutes = routersToDisplay
    .map(({ router, index }) => {
      const option = routeOptionByDexId.get(router.id) ?? null;
      const outputAmount = outputAmountToBigInt(option?.outputAmount);

      return {
        router,
        option,
        outputAmount,
        hasQuote: outputAmount > 0n,
        index,
      };
    })
    .filter((route) => route.option !== null && route.hasQuote)
    .sort((leftRoute, rightRoute) => {
      if (leftRoute.hasQuote && rightRoute.hasQuote) {
        if (leftRoute.outputAmount === rightRoute.outputAmount) {
          return leftRoute.index - rightRoute.index;
        }

        return leftRoute.outputAmount > rightRoute.outputAmount ? -1 : 1;
      }

      if (leftRoute.hasQuote !== rightRoute.hasQuote) {
        return leftRoute.hasQuote ? -1 : 1;
      }

      return leftRoute.index - rightRoute.index;
    });

  if (displayedRoutes.length === 0) {
    return null;
  }

  const bestQuotedRoute = displayedRoutes.find((route) => route.hasQuote) ?? null;
  const bestOutputAmount = bestQuotedRoute?.outputAmount ?? 0n;
  const normalizedSelectedRouterId = selectedRouterId
    ? normalizeRouterId(selectedRouterId)
    : undefined;
  const dexCount = displayedRoutes.length;
  const dexNamesLabel = displayedRoutes.map(({ router }) => router.name).join(", ");

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
            className="inline-grid h-3.5 min-w-6 shrink-0 place-items-center rounded-full border border-white/10 bg-[#2E2E2E] px-1 text-white"
            aria-label={`${dexCount} DEX routes available`}
          >
            <span className="flex items-center justify-center gap-0.5 translate-y-[0.5px] text-[9px] font-bold leading-none" >
              <span>{dexCount}</span>
              <Image
                src={routeIcon}
                alt=""
                width={8}
                height={8}
                className="h-[8px] w-[8px] shrink-0 object-contain"
              />
            </span>
          </span>
          <span className="truncate text-[11px] font-medium text-white/80">
            <span className="text-[9px] font-normal text-white/45">Via</span>{" "}
            <span>{dexNamesLabel}</span>
          </span>
          <span className="group relative flex h-4 w-4 shrink-0 items-center justify-center">
            <Info
              className="h-3.5 w-3.5 text-white/70 outline-none"
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
        {displayedRoutes.map(({ router, option, outputAmount, hasQuote }) => {
          const isBestPrice =
            hasQuote && outputAmount > 0n && outputAmount === bestOutputAmount;
          const isSelected =
            normalizedSelectedRouterId === router.id ||
            (!normalizedSelectedRouterId && isBestPrice);
          const routeUsdValue = hasQuote
            ? formatRouteUsdValue(option?.outputAmount, outputTokenUsdPrice)
            : null;

          return (
            <motion.div
              key={router.id}
              role="listitem"
              className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left transition-colors ${
                isSelected
                  ? `
    border border-[#56697c]
    bg-[#171b22]
    ring-1 ring-white/[0.04]
    shadow-[inset_0_1px_0_rgba(255,255,255,.06),inset_0_-1px_0_rgba(0,0,0,.45),0_2px_6px_rgba(0,0,0,.35)]
  `
                  : "border border-transparent"
              }`}
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
              <span className="flex shrink-0 flex-col items-end text-right leading-tight">
                <span
                  className={`text-sm tabular-nums ${
                    hasQuote ? "text-white/90" : "text-white/45"
                  }`}
                >
                  {formatRouteTokenAmount(option?.outputAmount, outputTokenSymbol)}
                </span>
                {routeUsdValue ? (
                  <span className="text-[11px] tabular-nums text-white/55">
                    ~ {routeUsdValue}
                  </span>
                ) : null}
              </span>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
