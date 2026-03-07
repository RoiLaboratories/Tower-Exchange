"use client";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function Bridge() {
  return (
    <main className="flex-1 flex items-center justify-center py-12 px-4 min-h-screen">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-2xl border border-border p-8 text-center space-y-6">
          {/* Icon */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex justify-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <ArrowRight className="w-8 h-8 text-primary" />
            </div>
          </motion.div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="space-y-2"
          >
            <h1 className="text-3xl font-bold text-foreground">Bridge</h1>
            <p className="text-muted-foreground text-sm">
              Cross-chain asset bridging coming soon
            </p>
          </motion.div>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="bg-secondary/50 rounded-lg p-4 space-y-2"
          >
            <p className="text-foreground text-sm font-medium">
              We're building a seamless bridge experience
            </p>
            <p className="text-muted-foreground text-xs">
              Transfer your assets across different blockchains with ease. This feature will be available soon.
            </p>
          </motion.div>

          {/* Decorative background elements */}
          <div className="absolute inset-0 -z-10 opacity-5">
            <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-primary blur-3xl" />
            <div className="absolute bottom-10 right-10 w-40 h-40 rounded-full bg-primary blur-3xl" />
          </div>
        </div>

        {/* Gradient background accent */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-2xl"
        />
      </motion.div>
    </main>
  );
}
