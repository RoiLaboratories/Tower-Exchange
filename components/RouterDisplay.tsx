"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Info } from "lucide-react";

interface Router {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
}

interface RouterDisplayProps {
  selectedRouterId?: string;
  onRouterSelect?: (routerId: string) => void;
  isAutoSelected?: boolean; // Indicates router was auto-selected by backend optimizer
}

export default function RouterDisplay({
  selectedRouterId,
  onRouterSelect,
  isAutoSelected = true, // Default to true since backend always selects now
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
        console.log("[RouterDisplay] Fetched routers:", data);
        
        // Extract array from data.data (NextResponse.json wraps in data property)
        const routersArray = data?.data || [];
        
        if (!Array.isArray(routersArray)) {
          console.warn("[RouterDisplay] Routers is not an array:", routersArray);
          throw new Error("Invalid routers response format");
        }
        
        setRouters(routersArray);
        setError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load routers";
        setError(errorMessage);
        console.error("[RouterDisplay] Router fetch error:", err);
        setRouters([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRouters();
  }, []);

  const selectedRouter = routers.find((r) => r.id === selectedRouterId);
  const routerTypeColor = {
    "pool-based": "bg-purple-500/10 text-purple-300",
    v3: "bg-blue-500/10 text-blue-300",
    v2: "bg-green-500/10 text-green-300",
    stable: "bg-orange-500/10 text-orange-300",
  };

  const typeColor =
    routerTypeColor[selectedRouter?.type as keyof typeof routerTypeColor] ||
    "bg-gray-500/10 text-gray-300";

  return (
    <div className="w-full">
      <motion.div
        className="p-3 bg-secondary/50 rounded-lg border border-primary/20 hover:border-primary/40 transition-colors cursor-pointer"
        onClick={() => !isAutoSelected && setIsOpen(!isOpen)}
        whileHover={{ backgroundColor: "rgba(123, 184, 255, 0.05)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Info className="w-4 h-4 text-primary/60" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {isAutoSelected ? "Auto-Selected Router" : "Selected Router"}
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
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-mono ${typeColor}`}
                    >
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
          {!isAutoSelected && (
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-5 h-5 text-primary/60" />
            </motion.div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {isOpen && !isAutoSelected && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 mt-2 w-full max-w-md bg-secondary border border-primary/20 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="max-h-96 overflow-y-auto p-2">
              {error && (
                <div className="p-3 text-xs text-red-400 bg-red-500/10 rounded-md mb-2">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Loading available routers...
                </div>
              ) : routers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No routers available
                </div>
              ) : (
                <div className="space-y-1">
                  {routers.map((router) => (
                    <motion.button
                      key={router.id}
                      onClick={() => {
                        onRouterSelect?.(router.id);
                        setIsOpen(false);
                      }}
                      whileHover={{ backgroundColor: "rgba(123, 184, 255, 0.1)" }}
                      className={`w-full p-3 text-left rounded-md transition-colors ${
                        selectedRouterId === router.id
                          ? "bg-primary/20 border-l-2 border-primary"
                          : "hover:bg-primary/5"
                      } ${!router.enabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      disabled={!router.enabled}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {router.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Type: {router.type}
                          </p>
                        </div>
                        <div
                          className={`text-xs px-2 py-1 rounded-full font-mono ${
                            routerTypeColor[
                              router.type as keyof typeof routerTypeColor
                            ] || "bg-gray-500/10 text-gray-300"
                          }`}
                        >
                          {router.enabled ? "✓" : "✗"}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
