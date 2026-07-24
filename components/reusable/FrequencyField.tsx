"use client";
import { useState, useEffect } from "react";
import { Info } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface FrequencyFieldProps {
  label: string;
  value: string;
  showInfo?: boolean;
  optional?: boolean;
  onClick?: () => void;
  infoMessage?: string;
  tooltipDirection?: 'left' | 'right' | 'responsive';
  wrapValue?: boolean;
  compactValue?: boolean;
  centerValue?: boolean;
}

export const FrequencyField = ({
  label,
  value,
  showInfo = false,
  optional = false,
  onClick,
  infoMessage,
  tooltipDirection = 'left',
  wrapValue = false,
  compactValue = false,
  centerValue = false,
}: FrequencyFieldProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Detect if device is touch-enabled
  useEffect(() => {
    const isTouchEnabled = () => {
      return (
        window.matchMedia("(pointer:coarse)").matches ||
        ("ontouchstart" in window) ||
        (navigator.maxTouchPoints > 0)
      );
    };
    setIsTouchDevice(isTouchEnabled());
  }, []);

  // Close tooltip when clicking outside (for touch devices)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-freq-info-button]")) {
        setShowTooltip(false);
      }
    };

    if (showTooltip && isTouchDevice) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showTooltip, isTouchDevice]);

  return (
    <div className="min-w-0">
      <div className="relative mb-2.5 flex min-w-0 items-center gap-1.5 overflow-visible sm:mb-3">
        <span className="shrink-0 whitespace-nowrap text-sm font-medium text-gray-200">
          {label}
        </span>
        {optional && (
          <span className="shrink-0 whitespace-nowrap text-xs font-medium leading-5 text-gray-200/60">
            (Optional)
          </span>
        )}
        {showInfo && (
          <div className="group flex shrink-0 items-center">
            <button
              data-freq-info-button
              onClick={() => isTouchDevice && setShowTooltip(!showTooltip)}
              onMouseEnter={() => !isTouchDevice && setShowTooltip(true)}
              onMouseLeave={() => !isTouchDevice && setShowTooltip(false)}
              className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors flex items-center"
              aria-label={`${label} information`}
            >
              <Info className="w-4 h-4" />
            </button>
            {showTooltip && infoMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`absolute top-full mt-1 z-50 w-56 max-w-[calc(100vw-2rem)] rounded-lg bg-[#0f1419]/95 border border-white/[0.1] px-3 py-2 text-xs text-gray-300 backdrop-blur-md whitespace-normal ${
                  tooltipDirection === 'left'
                    ? 'left-0'
                    : tooltipDirection === 'right'
                    ? 'right-0'
                    : 'left-0 sm:right-0 sm:left-auto'
                }`}
              >
                {infoMessage}
              </motion.div>
            )}
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        onClick={onClick}
        className={`h-auto w-full cursor-pointer rounded-xl border border-white/[0.04] bg-[#151617] px-4 py-3.5 text-sm transition-colors hover:bg-[#1f2125] sm:rounded-xl sm:py-4 ${
          centerValue ? "justify-center text-center" : "justify-start text-left"
        }`}
      >
        <span
          className={`min-w-0 text-white ${
            wrapValue
              ? "whitespace-normal break-words text-[13px] leading-5 sm:text-sm"
              : compactValue
                ? "truncate whitespace-nowrap text-[11px] leading-4 sm:text-xs lg:text-sm"
                : "truncate whitespace-nowrap"
          } ${centerValue ? "text-center" : ""}`}
        >
          {value}
        </span>
      </Button>
    </div>
  );
};
