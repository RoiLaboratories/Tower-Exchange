"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { supabase, ActivityRow } from "@/lib/supabase";
import { getTokenIcon } from "@/lib/tokenIcons";
import { StaticImageData } from "next/image";
import arcLogo from "@/public/assets/arc_logo_1-removebg-preview.png";

interface ActivitiesProps {
  isWalletConnected?: boolean;
  walletAddress?: string | null;
}

interface DisplayActivity {
  type: string;
  source: {
    token: string;
    icon: StaticImageData | null;
    network: string;
  };
  destination: {
    token: string;
    icon: StaticImageData | null;
    network: string;
  };
  status: "Successful" | "Failed";
  date: string;
  time: string;
  isCancellation?: boolean;
}

// Format timestamp to date and time
const formatTimestamp = (timestamp: string): { date: string; time: string } => {
  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return { date: dateStr, time: timeStr };
};

const Activities = ({
  isWalletConnected = false,
  walletAddress = null,
}: ActivitiesProps) => {
  const [activities, setActivities] = useState<DisplayActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      if (!isWalletConnected || !walletAddress) {
        setActivities([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("activities")
          .select("*")
          .eq("wallet_address", walletAddress.toLowerCase())
          .order("timestamp", { ascending: false })
          .limit(100);

        if (fetchError) {
          console.error("Error fetching activities:", fetchError);
          setError("Failed to load activities");
          setActivities([]);
          return;
        }

        // Transform Supabase data to display format
        const transformedActivities: DisplayActivity[] = (data || []).map(
          (row: ActivityRow) => {
            const { date, time } = formatTimestamp(row.timestamp);
            const isCancellation = row.type.toLowerCase().includes("cancelled");
            return {
              type: row.type,
              source: {
                token: row.source_currency_ticker,
                icon: getTokenIcon(row.source_currency_ticker),
                network: row.source_network_name,
              },
              destination: {
                token: row.destination_currency_ticker || "",
                icon: row.destination_currency_ticker
                  ? getTokenIcon(row.destination_currency_ticker)
                  : null,
                network: row.destination_network_name || "",
              },
              status: row.status === "Successful" ? "Successful" : "Failed",
              date,
              time,
              isCancellation,
            };
          }
        );

        setActivities(transformedActivities);
      } catch (err) {
        console.error("Unexpected error fetching activities:", err);
        setError("An unexpected error occurred");
        setActivities([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, [isWalletConnected, walletAddress]);

  // Show loading state
  if (isLoading) {
    return (
      <motion.div
        key="activities"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "hsl(220, 20%, 10%)",
          border: "1px solid hsl(220, 15%, 18%)",
        }}
      >
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading activities...</p>
        </div>
      </motion.div>
    );
  }

  // Show error state
  if (error) {
    return (
      <motion.div
        key="activities"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "hsl(220, 20%, 10%)",
          border: "1px solid hsl(220, 15%, 18%)",
        }}
      >
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <p className="text-red-400 mb-2">{error}</p>
          <p className="text-gray-400 text-sm text-center">
            Please check your Supabase configuration.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="activities"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: "hsl(220, 20%, 10%)",
        border: "1px solid hsl(220, 15%, 18%)",
      }}
    >
      {activities.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(220, 15%, 18%)" }}>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Type
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Source
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Destination
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Status
                </th>
                <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity, index) => (
                <motion.tr
                  key={`${activity.type}-${index}-${activity.date}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  whileHover={{
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                  }}
                  className="transition-colors"
                  style={{
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{activity.type}</span>
                      {activity.isCancellation && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/50">
                          Cancelled
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {activity.source.icon ? (
                          <div className="shrink-0 w-8 h-8">
                            <Image
                              src={activity.source.icon}
                              alt={`${activity.source.token} logo`}
                              width={32}
                              height={32}
                              className="object-contain w-full h-full"
                            />
                          </div>
                        ) : (
                          <div className="shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                            <span className="text-xs font-medium">
                              {activity.source.token[0]}
                            </span>
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center bg-white border border-gray-300">
                          <Image
                            src={arcLogo}
                            alt="Arc chain"
                            width={16}
                            height={16}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">
                          {activity.source.token}
                        </div>
                        <div className="text-xs text-gray-400">
                          {activity.source.network}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    {activity.destination.token ? (
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {activity.destination.icon ? (
                            <div className="shrink-0 w-8 h-8">
                              <Image
                                src={activity.destination.icon}
                                alt={`${activity.destination.token} logo`}
                                width={32}
                                height={32}
                                className="object-contain w-full h-full"
                              />
                            </div>
                          ) : (
                            <div className="shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                              <span className="text-xs font-medium">
                                {activity.destination.token[0]}
                              </span>
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center bg-white border border-gray-300">
                            <Image
                              src={arcLogo}
                              alt="Arc chain"
                              width={16}
                              height={16}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">
                            {activity.destination.token}
                          </div>
                          <div className="text-xs text-gray-400">
                            {activity.destination.network}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="py-5 px-6">
                    <motion.span
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        delay: index * 0.05 + 0.15,
                        duration: 0.3,
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border inline-block ${
                        activity.status === "Successful"
                          ? "text-green-400 border-green-400/30 bg-green-400/10"
                          : "text-red-400 border-red-400/30 bg-red-400/10"
                      }`}
                    >
                      {activity.status}
                    </motion.span>
                  </td>
                  <td className="py-5 px-6 text-right">
                    <div className="font-medium">{activity.date}</div>
                    <div className="text-xs text-gray-400">{activity.time}</div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-20 px-6"
        >
          <div className="mb-6">
            <Image
              src="/assets/wallet.png"
              alt={
                isWalletConnected
                  ? "No transactions yet"
                  : "No wallet connected"
              }
              width={80}
              height={80}
              className="w-20 h-20 opacity-60"
            />
          </div>
          <h4 className="text-xl font-semibold mb-2">
            {isWalletConnected
              ? "No transactions yet"
              : "No wallet connected"}
          </h4>
          <p className="text-gray-400 text-center">
            {isWalletConnected
              ? "Your swap and transfer activity will appear here."
              : "Connect your wallet to view activity."}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Activities;
