"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Droplets } from "lucide-react";
import TokenTicker from "@/components/TokenTicker";
import ComingSoonModal from "@/components/ComingSoonModal";

export default function PoolPage() {
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setModalOpen(true);
  }, []);

  return (
    <>
      <TokenTicker />
      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12">
        {/* Background placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative w-full max-w-lg"
        >
          <div className="rounded-[1.75rem] border border-border/50 bg-card/40 p-8 backdrop-blur-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Droplets className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground/80">Liquidity Pools</h1>
                <p className="text-xs text-muted-foreground">Provide liquidity & earn yield</p>
              </div>
            </div>

            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 0.35, x: 0 }}
                  transition={{ delay: 0.1 * i, duration: 0.4 }}
                  className="flex items-center justify-between rounded-xl border border-border/30 bg-secondary/30 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                      <div className="h-2 w-16 rounded bg-muted/60 animate-pulse" />
                    </div>
                  </div>
                  <div className="h-3 w-12 rounded bg-muted/60 animate-pulse" />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </main>

      <ComingSoonModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        feature="Pool"
        title="Pools Are Coming Soon"
        description="Tower liquidity pools are in development. Soon you'll be able to add liquidity, earn fees, and manage positions — all in one place."
        ctaLabel="Explore Swap"
        ctaPath="/"
      />
    </>
  );
}
