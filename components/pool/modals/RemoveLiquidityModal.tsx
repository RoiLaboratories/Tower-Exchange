"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import TokenPairIcon from "@/components/pool/TokenPairIcon";
import type { PoolPositionStatus } from "@/lib/pool/types";
import { getTokenIcon } from "@/lib/tokenIcons";

const PRESETS = [
  { label: "25%", value: 25 },
  { label: "50%", value: 50 },
  { label: "75%", value: 75 },
  { label: "Max", value: 100 },
] as const;

interface RemoveLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRemove?: (percent: number) => void;
  pair: string;
  token0: string;
  token1: string;
  status: PoolPositionStatus;
  pooled0?: string;
  pooled1?: string;
  fees0?: string;
  fees1?: string;
}

const STATUS_LABELS: Record<PoolPositionStatus, string> = {
  "in-range": "In range",
  "out-of-range": "Out of range",
  closed: "Closed",
};

const STATUS_TEXT: Record<PoolPositionStatus, string> = {
  "in-range": "text-[#07D54F]",
  "out-of-range": "text-[#FF5A5F]",
  closed: "text-muted-foreground",
};

const STATUS_DOT: Record<PoolPositionStatus, string> = {
  "in-range": "bg-[#07D54F]",
  "out-of-range": "bg-[#FF5A5F]",
  closed: "bg-white/40",
};

function TokenValueRow({
  label,
  amount,
  token,
}: {
  label: string;
  amount: string;
  token: string;
}) {
  const icon = getTokenIcon(token);

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="min-w-0 truncate text-sm font-light text-foreground">
        {label}
      </span>
      <div className="inline-flex shrink-0 items-center gap-2">
        <span className="text-sm font-light tabular-nums text-foreground">
          {amount}
        </span>
        <span className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-card">
          {icon ? (
            <Image
              src={icon}
              alt=""
              width={20}
              height={20}
              className="h-full w-full object-contain"
            />
          ) : null}
        </span>
      </div>
    </div>
  );
}

export default function RemoveLiquidityModal({
  isOpen,
  onClose,
  onRemove,
  pair,
  token0,
  token1,
  status,
  pooled0 = "0",
  pooled1 = "0",
  fees0 = "0.028282",
  fees1 = "0.232424",
}: RemoveLiquidityModalProps) {
  const [percent, setPercent] = useState(0);

  const ctaLabel = useMemo(
    () => (percent > 0 ? "Remove" : "Enter an Amount"),
    [percent],
  );

  if (typeof document === "undefined") {
    return null;
  }

  const handleRemove = () => {
    if (percent <= 0) {
      return;
    }
    onRemove?.(percent);
    onClose();
    setPercent(0);
  };

  const handleClose = () => {
    onClose();
    setPercent(0);
  };

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="remove-liquidity-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-[420px] rounded-[30px] bg-card px-5 pb-5 pt-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleClose}
                aria-label="Back"
                className="inline-flex h-8 w-8 items-center justify-center text-foreground transition-opacity hover:opacity-80"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-base font-medium text-foreground">
                Remove Liquidity
              </h2>
              {/* Settings temporarily hidden
              <button
                type="button"
                aria-label="Settings"
                className="inline-flex h-8 w-8 items-center justify-center text-foreground transition-opacity hover:opacity-80"
              >
                <Settings className="h-5 w-5" />
              </button>
              */}
              <span className="inline-flex h-8 w-8" aria-hidden />
            </div>

            <div className="mt-5 flex min-w-0 items-center justify-between gap-3">
              <div className="inline-flex min-w-0 items-center gap-2.5">
                <TokenPairIcon token0={token0} token1={token1} size="md" />
                <span className="truncate text-sm font-medium text-foreground">
                  {pair}
                </span>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-light ${STATUS_TEXT[status]}`}
              >
                {STATUS_LABELS[status]}
                <span
                  className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`}
                  aria-hidden
                />
              </span>
            </div>

            <div className="mt-4 rounded-[20px] bg-secondary px-4 py-4 shadow-[inset_0_0_0_1px_#2F2F2F]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-light text-muted-foreground">Amount</p>
                  <p className="mt-2 text-[32px] font-medium leading-none tracking-tight text-foreground sm:text-[40px]">
                    {percent}%
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {PRESETS.map((preset) => {
                    const active = percent === preset.value;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setPercent(preset.value)}
                        className={`inline-flex h-7 items-center justify-center rounded-full px-2.5 text-xs font-medium transition-colors ${
                          active
                            ? "bg-primary text-black"
                            : "bg-muted text-foreground hover:bg-accent"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={percent}
                onChange={(event) => setPercent(Number(event.target.value))}
                aria-label="Removal percent"
                className="mt-5 w-full accent-[#7BB8FF]"
              />
            </div>

            <div className="mt-3 space-y-3 rounded-[20px] bg-secondary px-4 py-4 shadow-[inset_0_0_0_1px_#2F2F2F]">
              <TokenValueRow
                label={`Pooled ${token1}:`}
                amount={pooled1}
                token={token1}
              />
              <TokenValueRow
                label={`Pooled ${token0}:`}
                amount={pooled0}
                token={token0}
              />
              <div className="border-t border-border" />
              <TokenValueRow
                label={`${token1} Fees Earned:`}
                amount={fees1}
                token={token1}
              />
              <TokenValueRow
                label={`${token0} Fees Earned:`}
                amount={fees0}
                token={token0}
              />
            </div>

            <button
              type="button"
              onClick={handleRemove}
              disabled={percent <= 0}
              className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-black transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
            >
              {ctaLabel}
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
