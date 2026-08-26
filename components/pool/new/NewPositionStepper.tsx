"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, RotateCcw, Settings } from "lucide-react";
import PositionSettingsModal from "@/components/pool/modals/PositionSettingsModal";
import ResetConfirmModal from "@/components/pool/modals/ResetConfirmModal";
import type { NewPositionSelection } from "@/lib/pool/newPosition";
import {
  formatPoolFeeLabel,
  formatPoolPairLabel,
} from "@/lib/pool/newPosition";

const SIDEBAR_CARD_CLASS = "w-full bg-card";

interface NewPositionStepperProps {
  currentStep: 1 | 2;
  compact?: boolean;
}

export default function NewPositionStepper({
  currentStep,
  compact = false,
}: NewPositionStepperProps) {
  const steps = [
    {
      number: 1,
      title: "Step 1",
      description: "Select token pair",
    },
    {
      number: 2,
      title: "Step 2",
      description: "Set price range and deposit amounts",
    },
  ] as const;

  return (
    <nav className={`${SIDEBAR_CARD_CLASS} ${compact ? "rounded-xl px-4 py-4" : "rounded-2xl px-6 py-5"}`}>
      <ol className="space-y-0">
        {steps.map((step, index) => {
          const isActive = currentStep === step.number;
          const isComplete = currentStep > step.number;

          return (
            <li key={step.number} className={`flex ${compact ? "gap-3" : "gap-4"}`}>
              <div className="flex flex-col items-center">
                <span
                  className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${
                    compact ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm"
                  } ${
                    isActive
                      ? "bg-primary text-[#0C0C0D]"
                      : isComplete
                        ? "bg-muted text-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.number}
                </span>
                {index < steps.length - 1 ? (
                  <span className={`w-px bg-border ${compact ? "my-1 h-6" : "my-1.5 h-8"}`} />
                ) : null}
              </div>
              <div className={`min-w-0 flex-1 ${compact ? "pb-4" : "pb-6"} ${index === steps.length - 1 ? "pb-0" : ""}`}>
                <p
                  className={`font-semibold ${compact ? "text-xs" : "text-sm"} ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.title}
                </p>
                <p
                  className={`mt-1 break-words leading-snug ${compact ? "text-xs" : "text-sm"} ${
                    isActive ? "text-muted-foreground" : "text-muted-foreground/70"
                  }`}
                >
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface NewPositionSummaryCardProps {
  selection: NewPositionSelection;
  compact?: boolean;
}

export function NewPositionSummaryCard({
  selection,
  compact = false,
}: NewPositionSummaryCardProps) {
  const rows = [
    {
      label: "Pair",
      value: formatPoolPairLabel(selection.token0, selection.token1),
    },
    {
      label: "Fee",
      value: formatPoolFeeLabel(selection.fee),
    },
    {
      label: "Mode",
      value: "0.0000023223",
    },
  ];

  return (
    <div className={`${SIDEBAR_CARD_CLASS} ${compact ? "rounded-xl px-4 py-3" : "rounded-2xl px-6 py-4"}`}>
      <h3 className={`font-semibold text-foreground ${compact ? "text-sm" : "text-base"}`}>
        Position
      </h3>

      <dl className={`${compact ? "mt-3 space-y-2" : "mt-4 space-y-3"}`}>
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <dt className={`shrink-0 text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>
              {row.label}
            </dt>
            <dd className={`min-w-0 truncate text-right font-light text-foreground tabular-nums ${compact ? "text-xs" : "text-sm"}`}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface NewPositionPageHeaderProps {
  onReset?: () => void;
  compact?: boolean;
}

export function NewPositionPageHeader({
  onReset,
  compact = false,
}: NewPositionPageHeaderProps) {
  const [resetOpen, setResetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className={compact ? "mb-4" : "mb-6"}>
      <div className={`mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground ${compact ? "text-xs" : ""}`}>
        <Link href="/pool" className="transition-colors hover:text-foreground">
          Your Positions
        </Link>
        <ChevronRight
          className={`shrink-0 text-muted-foreground ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`}
          aria-hidden
        />
        <span className="text-foreground">New Position</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1
          className={`font-semibold tracking-tight text-foreground ${
            compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
          }`}
        >
          Your Positions
        </h1>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className={`inline-flex items-center gap-2 rounded-[8px] border border-border bg-secondary font-medium text-foreground transition-colors hover:bg-accent ${
              compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
            }`}
          >
            <RotateCcw className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            Reset
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Position settings"
            className={`inline-flex items-center justify-center rounded-[8px] border border-border bg-secondary text-foreground transition-colors hover:bg-accent ${
              compact ? "h-8 w-8" : "h-10 w-10"
            }`}
          >
            <Settings className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </button>
        </div>
      </div>

      <ResetConfirmModal
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => onReset?.()}
      />
      <PositionSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
