"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { formatUsdAmount } from "@/lib/formatUsdAmount";
import { fetchActivitiesByWallet, type ActivityRow } from "@/lib/supabase";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";
import usdcLogo from "@/public/assets/usdc.svg";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";

type Timeframe = "24H" | "7D" | "30D" | "ALL";

type ChartPoint = {
  label: string;
  value: number;
};

const timeframes: Timeframe[] = ["24H", "7D", "30D", "ALL"];

const TIMEFRAME_CONFIG: Record<
  Timeframe,
  { bucketCount: number; durationMs: number | null }
> = {
  "24H": { bucketCount: 12, durationMs: 24 * 60 * 60 * 1000 },
  "7D": { bucketCount: 7, durationMs: 7 * 24 * 60 * 60 * 1000 },
  "30D": { bucketCount: 10, durationMs: 30 * 24 * 60 * 60 * 1000 },
  ALL: { bucketCount: 12, durationMs: null },
};

const FALLBACK_CHARTS: Record<Timeframe, number[]> = {
  "24H": [0, 0, 12, 12, 19, 25, 25, 34, 42, 42, 51, 51],
  "7D": [0, 18, 18, 43, 67, 67, 94],
  "30D": [0, 21, 44, 44, 73, 101, 138, 138, 166, 202],
  ALL: [0, 24, 58, 91, 125, 168, 215, 266, 318, 384, 443, 512],
};

const formatTimestampLabel = (timestamp?: string | null) => {
  if (!timestamp) {
    return "No activity yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
};

const formatBucketLabel = (timestamp: number, timeframe: Timeframe) => {
  const date = new Date(timestamp);

  if (timeframe === "24H") {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
    }).format(date);
  }

  if (timeframe === "ALL") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
};

const getActivityUsdAmount = (activity: ActivityRow) => {
  const amount = Number(activity.amount_usd ?? activity.amount ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const isSuccessfulVolumeActivity = (activity: ActivityRow) =>
  activity.status === "Successful" && getActivityUsdAmount(activity) > 0;

const getTimeframeStart = (
  activities: ActivityRow[],
  timeframe: Timeframe,
  now: number,
) => {
  const { durationMs } = TIMEFRAME_CONFIG[timeframe];

  if (durationMs !== null) {
    return now - durationMs;
  }

  const earliestTimestamp = activities.reduce<number | null>((earliest, activity) => {
    const timestamp = new Date(activity.timestamp).getTime();

    if (!Number.isFinite(timestamp)) {
      return earliest;
    }

    return earliest === null ? timestamp : Math.min(earliest, timestamp);
  }, null);

  return earliestTimestamp ?? now - 365 * 24 * 60 * 60 * 1000;
};

const buildFallbackChart = (timeframe: Timeframe): ChartPoint[] => {
  const values = FALLBACK_CHARTS[timeframe];
  return values.map((value, index) => ({
    label: String(index + 1),
    value,
  }));
};

const buildVolumeChart = (
  activities: ActivityRow[],
  timeframe: Timeframe,
): { chartData: ChartPoint[]; totalVolume: number; latestTimestamp: string | null } => {
  const successfulActivities = activities.filter(isSuccessfulVolumeActivity);

  if (successfulActivities.length === 0) {
    return {
      chartData: buildFallbackChart(timeframe),
      totalVolume: 0,
      latestTimestamp: null,
    };
  }

  const now = Date.now();
  const { bucketCount } = TIMEFRAME_CONFIG[timeframe];
  const start = getTimeframeStart(successfulActivities, timeframe, now);
  const bucketSize = Math.max((now - start) / bucketCount, 1);
  const buckets = Array.from({ length: bucketCount }, () => 0);
  let latestTimestamp: string | null = null;

  successfulActivities.forEach((activity) => {
    const timestamp = new Date(activity.timestamp).getTime();

    if (!Number.isFinite(timestamp) || timestamp < start || timestamp > now) {
      return;
    }

    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor((timestamp - start) / bucketSize)),
    );
    buckets[bucketIndex] += getActivityUsdAmount(activity);

    if (
      !latestTimestamp ||
      new Date(activity.timestamp).getTime() > new Date(latestTimestamp).getTime()
    ) {
      latestTimestamp = activity.timestamp;
    }
  });

  let runningTotal = 0;
  const chartData = buckets.map((bucketValue, index) => {
    runningTotal += bucketValue;
    const bucketTimestamp = start + bucketSize * index;

    return {
      label: formatBucketLabel(bucketTimestamp, timeframe),
      value: Number(runningTotal.toFixed(2)),
    };
  });

  return {
    chartData,
    totalVolume: runningTotal,
    latestTimestamp,
  };
};

export const PortfolioAnalysis = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>("7D");
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const { user } = useRainbowKitAuth();
  const walletAddress = user?.wallet?.address ?? null;

  useEffect(() => {
    let isMounted = true;

    const fetchActivities = async () => {
      if (!walletAddress) {
        setActivities([]);
        return;
      }

      setIsLoadingActivities(true);

      try {
        const { data, error, success } = await fetchActivitiesByWallet(
          walletAddress,
          { limit: 500, ascending: true },
        );

        if (!success || error) {
          console.error("Error fetching portfolio activity chart data:", error);
          if (isMounted) {
            setActivities([]);
          }
          return;
        }

        if (isMounted) {
          setActivities((data || []) as ActivityRow[]);
        }
      } catch (error) {
        console.error("Unable to load portfolio activity chart data:", error);
        if (isMounted) {
          setActivities([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingActivities(false);
        }
      }
    };

    fetchActivities();

    return () => {
      isMounted = false;
    };
  }, [walletAddress]);

  const { chartData, totalVolume, latestTimestamp } = useMemo(
    () => buildVolumeChart(activities, timeframe),
    [activities, timeframe],
  );

  const positions = [
    {
      token: "USDC",
      amount: "1,000",
      value: "$999.99",
      change: "+0.01%",
      logo: usdcLogo,
    },
    {
      token: "USDC",
      amount: "1,000",
      value: "$999.99",
      change: "+0.01%",
      logo: usdcLogo,
    },
    {
      token: "USDC",
      amount: "1,000",
      value: "$999.99",
      change: "+0.01%",
      logo: usdcLogo,
    },
  ];

  const closedPositions = [
    {
      pair: "ETH x USDC",
      amount: "1 ETH = 3000 USDC",
      logos: {
        eth: ethLogo,
        usdc: usdcLogo,
      },
    },
    {
      pair: "ETH x USDC",
      amount: "1 ETH = 3200 USDC",
      logos: {
        eth: ethLogo,
        usdc: usdcLogo,
      },
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 rounded-2xl border border-border bg-[#191A1C] p-4 sm:space-y-6 sm:rounded-2xl sm:p-6 lg:space-y-4 lg:p-4 xl:space-y-6 xl:p-6"
    >
      <div className="rounded-xl bg-[#151617] p-3 sm:p-4 lg:p-3 xl:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 lg:flex-nowrap lg:gap-1.5">
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-2 xl:gap-3">
            <button className="whitespace-nowrap text-sm font-medium text-white sm:text-base lg:text-[0.9rem] xl:text-base">
              PNL
            </button>
            <button className="whitespace-nowrap text-sm text-gray-500 sm:text-base lg:text-[0.9rem] xl:text-base">
              Volume
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-1">
            {timeframes.map((tf) => (
              <motion.button
                key={tf}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setTimeframe(tf)}
                className={`whitespace-nowrap rounded-lg px-2 py-1 text-xs sm:px-3 sm:text-sm lg:px-1.5 lg:py-0.5 lg:text-[0.68rem] xl:px-2 xl:py-1 xl:text-xs ${
                  timeframe === tf
                    ? "text-black bg-[#7BB8FF]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tf}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xl font-bold text-white sm:text-2xl lg:text-[1.4rem] xl:text-2xl">
            {isLoadingActivities ? "Loading..." : `${formatUsdAmount(totalVolume, 1)} USD`}
          </div>
          <div className="text-xs text-gray-400 sm:text-sm">
            {formatTimestampLabel(latestTimestamp)}
          </div>
        </div>

        <div className="relative h-24 sm:h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 4, left: 4, bottom: 4 }}
            >
              <defs>
                <linearGradient id="portfolio-volume-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7BB8FF" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#7BB8FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="#7BB8FF"
                strokeWidth={2}
                fill="url(#portfolio-volume-gradient)"
                fillOpacity={1}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-white sm:mb-4 sm:text-lg">
          Open Positions
        </h3>
        <div className="space-y-2">
          {positions.map((position, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
              className="flex items-center justify-between rounded-xl bg-[#151617] p-3 sm:p-4"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full sm:h-8 sm:w-8">
                  <Image
                    src={position.logo}
                    alt={position.token}
                    width={32}
                    height={32}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div>
                  <div className="text-sm font-medium text-white sm:text-base">
                    {position.token} <span className="text-gray-400">{position.amount}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-white sm:text-base">
                  {position.value}
                </div>
                <div className="text-xs text-green-400 sm:text-sm">{position.change}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-white sm:mb-4 sm:text-lg">
          Closed Positions
        </h3>
        <div className="flex flex-col gap-2 xl:flex-row">
          {closedPositions.map((position, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              className="min-w-0 flex-1 rounded-xl border border-border bg-[#151617] p-3 sm:p-4 lg:p-3 xl:p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="flex -space-x-2">
                  <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-950 sm:h-6 sm:w-6 lg:h-5 lg:w-5 xl:h-6 xl:w-6">
                    <Image
                      src={position.logos.eth}
                      alt="ETH"
                      width={24}
                      height={24}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-950 sm:h-6 sm:w-6 lg:h-5 lg:w-5 xl:h-6 xl:w-6">
                    <Image
                      src={position.logos.usdc}
                      alt="USDC"
                      width={24}
                      height={24}
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>
                <span className="whitespace-nowrap text-xs font-medium text-white sm:text-sm lg:text-[0.78rem] xl:text-sm">
                  {position.pair}
                </span>
              </div>
              <div className="text-xs text-gray-400 lg:text-[0.72rem] xl:text-xs">
                {position.amount}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
