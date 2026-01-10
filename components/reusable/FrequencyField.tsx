"use client";
import { Info } from "lucide-react";

interface FrequencyFieldProps {
  label: string;
  value: string;
  showInfo?: boolean;
  optional?: boolean;
}

export const FrequencyField = ({
  label,
  value,
  showInfo = false,
  optional = false,
}: FrequencyFieldProps) => (
  <div>
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm font-medium text-white">
        {label}
        {optional && <span className="text-gray-600"> (Optional)</span>}
      </span>
      {showInfo && <Info className="w-4 h-4 text-gray-500" />}
    </div>
    <div className="px-4 py-3 rounded-xl bg-zinc-950">
      <span className="text-white">{value}</span>
    </div>
  </div>
);
