"use client";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FrequencyFieldProps {
  label: string;
  value: string;
  showInfo?: boolean;
  optional?: boolean;
  onClick?: () => void;
}

export const FrequencyField = ({
  label,
  value,
  showInfo = false,
  optional = false,
  onClick,
}: FrequencyFieldProps) => (
  <div>
    <div className="mb-2.5 flex items-center gap-2 sm:mb-3">
      <span className="whitespace-nowrap text-sm font-medium text-white">
        {label}
        {optional && <span className="whitespace-nowrap text-gray-600"> (Optional)</span>}
      </span>
      {showInfo && <Info className="w-4 h-4 text-gray-500" />}
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
