"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Info } from "lucide-react";
import { AppErrorModal } from "@/components/AppErrorModal";

interface Router {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
}

interface RouteOption {
  dexId: string;
  dexName: string;
  outputAmount: string;
  routeType: string;
}

interface RouterDisplayProps {
  selectedRouterId?: string;
  onRouterSelect?: (routerId: string) => void;
  routeOptions?: RouteOption[];
  isAutoSelected?: boolean;
}

const HIDDEN_ROUTER_IDS = new Set(["swaparc", "quantum-exchange"]);

const normalizeRouterId = (id: string) => (id === "synthra-v3" ? "synthra" : id);

const normalizeRouterName = (id: string, name: string) =>
  normalizeRouterId(id) === "synthra" ? "Synthra" : name;

const isVisibleRouter = (id: string, name = "") => {
  const normalizedId = normalizeRouterId(id).toLowerCase();
  const normalizedName = name.toLowerCase();

  return (
    !HIDDEN_ROUTER_IDS.has(normalizedId) &&
    !normalizedName.includes("swaparc") &&
    !normalizedName.includes("quantum")
  );
};

const outputAmountToBigInt = (amount: string) => {
  try {
    return BigInt(amount || "0");
  } catch {
    return 0n;
  }
};

export default function RouterDisplay({
  selectedRouterId,
  onRouterSelect,
  routeOptions = [],
  isAutoSelected = false,
}: RouterDisplayProps) {
  const [routers, setRouters] = useState<Router[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRouters = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/swap/dexes");

        if (!response.ok) {
          throw new Error(`Failed to fetch routers: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const routersArray = data?.data || [];

        if (!Array.isArray(routersArray)) {
          throw new Error("Invalid routers response format");
        }

        setRouters(
          routersArray
            .filter((router: Router) => isVisibleRouter(router.id, router.name))
            .map((router: Router) => ({
              ...router,
              id: normalizeRouterId(router.id),
              name: normalizeRouterName(router.id, router.name),
            })),
        );
        setError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load routers";
        setError(errorMessage);
        setRouters([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRouters();
  }, []);

  const visibleRouteOptions = useMemo(
    () =>
      routeOptions
        .filter((option) => isVisibleRouter(option.dexId, option.dexName))
        .map((option) => ({
          ...option,
          dexId: normalizeRouterId(option.dexId),
          dexName: normalizeRouterName(option.dexId, option.dexName),
        })),
    [routeOptions],
  );

  const routeOptionByDexId = useMemo(() => {
    const optionsByDexId = new Map<string, RouteOption>();

    for (const option of visibleRouteOptions) {
      const existingOption = optionsByDexId.get(option.dexId);

      if (
        !existingOption ||
        outputAmountToBigInt(option.outputAmount) >
          outputAmountToBigInt(existingOption.outputAmount)
      ) {
        optionsByDexId.set(option.dexId, option);
      }
    }

    return optionsByDexId;
  }, [visibleRouteOptions]);

  const mergedRouters = useMemo(
    () => [
      ...routers,
      ...visibleRouteOptions
        .filter((option) => !routers.some((router) => router.id === option.dexId))
        .map((option) => ({
          id: option.dexId,
          name: option.dexName,
          type: option.routeType,
          enabled: true,
        })),
    ],
    [visibleRouteOptions, routers],
  );

  const normalizedSelectedRouterId = selectedRouterId
    ? normalizeRouterId(selectedRouterId)
    : selectedRouterId;
  const selectedRouter = mergedRouters.find((router) => router.id === normalizedSelectedRouterId);
  const routerTypeColor = {
    "pool-based": "bg-purple-500/10 text-purple-300",
    v3: "bg-blue-500/10 text-blue-300",
    v2: "bg-green-500/10 text-green-300",
    stable: "bg-orange-500/10 text-orange-300",
    single: "bg-blue-500/10 text-blue-300",
    multi: "bg-cyan-500/10 text-cyan-300",
    split: "bg-amber-500/10 text-amber-300",
  };

  const typeColor =
    routerTypeColor[selectedRouter?.type as keyof typeof routerTypeColor] ||
    "bg-gray-500/10 text-gray-300";

  return (
    <>
      <AppErrorModal
        error={error}
        onClose={() => setError(null)}
        onRetry={() => setLoading(true)}
        title="Failed to load routers"
      />
      <div className="w-full relative">
        <motion.div
          className="p-3 bg-secondary/50 rounded-lg border border-primary/20 hover:border-primary/40 transition-colors cursor-pointer"
          onClick={() => setIsOpen((open) => !open)}
          whileHover={{ backgroundColor: "rgba(123, 184, 255, 0.05)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <Info className="w-4 h-4 text-primary/60" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {isAutoSelected ? "Best Route" : "Selected Router"}
                  </p>
                  {isAutoSelected && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">
                      Optimized
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedRouter ? (
                    <>
                      <p className="text-sm font-medium text-white">
                        {selectedRouter.name}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full font-mono ${typeColor}`}>
                        {selectedRouter.type}
                      </span>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {loading ? "Loading..." : "No router selected"}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="w-5 h-5 text-primary/60" />
            </motion.div>
          </div>
        </motion.div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute z-50 mt-2 w-full bg-secondary border border-primary/20 rounded-lg shadow-lg overflow-hidden"
            >
              <div className="max-h-96 overflow-y-auto p-2">
                {loading ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    Loading available routers...
                  </div>
                ) : mergedRouters.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No routers available
                  </div>
                ) : (
                  <div className="space-y-1">
                    {mergedRouters.map((router) => {
                      const option = routeOptionByDexId.get(router.id);

                      return (
                        <motion.button
                          key={router.id}
                          onClick={() => {
                            onRouterSelect?.(router.id);
                            setIsOpen(false);
                          }}
                          whileHover={{ backgroundColor: "rgba(123, 184, 255, 0.1)" }}
                          className={`w-full p-3 text-left rounded-md transition-colors ${
                            normalizedSelectedRouterId === router.id
                              ? "bg-primary/20 border-l-2 border-primary"
                              : "hover:bg-primary/5"
                          } ${!router.enabled ? "opacity-50 cursor-not-allowed" : ""}`}
                          disabled={!router.enabled}
                        >
                          <div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white">{router.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Type: {router.type}
                                {option ? ` - Output: ${option.outputAmount}` : ""}
                              </p>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
