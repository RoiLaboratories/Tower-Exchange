"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, RotateCcw, X } from "lucide-react";
import { createPortal } from "react-dom";

import { getBridgeErrorPresentation } from "@/lib/bridgeErrorDisplay";

type BridgeErrorModalProps = {
  error: string | null;
  onClose: () => void;
  onRetry?: () => void;
  fromChainName?: string | null;
  toChainName?: string | null;
  fromGasBalance?: string | null;
  toGasBalance?: string | null;
  fromGasTokenSymbol?: string | null;
  toGasTokenSymbol?: string | null;
};

export function BridgeErrorModal({
  error,
  onClose,
  onRetry,
  fromChainName,
  toChainName,
  fromGasBalance,
  toGasBalance,
  fromGasTokenSymbol,
  toGasTokenSymbol,
}: BridgeErrorModalProps) {
  if (typeof document === "undefined") {
    return null;
  }

  const presentation = getBridgeErrorPresentation(error, {
    fromChainName,
    toChainName,
    fromGasBalance,
    toGasBalance,
    fromGasTokenSymbol,
    toGasTokenSymbol,
  });

  if (!presentation) {
    return null;
  }

  const isInviteGateOpen = document.body.dataset.inviteGateOpen === "true";
  const accentClasses =
    presentation.tone === "critical"
      ? "border-red-400/20 bg-red-500/[0.08] text-red-200"
      : "border-amber-400/20 bg-amber-500/[0.08] text-amber-100";
  const iconShellClasses =
    presentation.tone === "critical"
      ? "bg-red-500/[0.14] text-red-300"
      : "bg-amber-500/[0.14] text-amber-200";
  const Icon = presentation.icon;

  return createPortal(
    <AnimatePresence>
      {!isInviteGateOpen && error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg rounded-[1.75rem] border border-border bg-card/90 p-5 shadow-2xl backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Dismiss bridge error"
            >
              <X size={16} />
            </button>

            <div className="pr-10">
              <div className="mb-4 flex items-start gap-3">
                <div
                  className={`mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconShellClasses}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div
                    className={`mb-2 inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${accentClasses}`}
                  >
                    {presentation.category}
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {presentation.title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {presentation.summary}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <section className="rounded-2xl border border-border bg-white/[0.04] p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <span>What to do next</span>
                  </div>
                  <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                    {presentation.guidance.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-2xl border border-border bg-black/20 p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Technical details
                  </p>
                  <p className="break-words font-mono text-xs leading-6 text-muted-foreground">
                    {presentation.rawError}
                  </p>
                </section>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-full border border-border bg-secondary/80 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Close
              </button>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-100"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Try Again</span>
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
