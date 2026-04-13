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
}

export const FrequencyField = ({
  label,
  value,
  showInfo = false,
  optional = false,
  onClick,
  infoMessage,
  tooltipDirection = 'left',
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
    <div>
      <div className="mb-2.5 flex items-center gap-2 sm:mb-3">
        <span className="whitespace-nowrap text-sm font-medium text-white">
          {label}
          {optional && <span className="whitespace-nowrap text-gray-600"> (Optional)</span>}
        </span>
        {showInfo && (
          <div className="relative group flex items-center">
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
                className={`absolute top-full mt-1 z-50 w-56 rounded-lg bg-[#0f1419]/95 border border-white/[0.1] px-3 py-2 text-xs text-gray-300 backdrop-blur-md whitespace-normal ${
                  tooltipDirection === 'left' 
                    ? 'left-0' 
                    : tooltipDirection === 'right' 
                    ? 'right-0' 
                    : 'left-0 sm:left-auto sm:right-0'
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
        className="h-auto w-full cursor-pointer justify-start rounded-[16px] border border-white/[0.04] bg-[#232324] px-4 py-3.5 text-left text-sm transition-colors hover:bg-[#2a2a2c] sm:rounded-[18px] sm:py-4"
      >
        <span className="text-white">{value}</span>
      </Button>
    </div>
  );
};
