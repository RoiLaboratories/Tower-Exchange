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
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm font-medium text-white">
        {label}
        {optional && <span className="text-gray-600"> (Optional)</span>}
      </span>
      {showInfo && <Info className="w-4 h-4 text-gray-500" />}
    </div>

    <Button
      variant="ghost"
      onClick={onClick}
      className="w-full px-4 py-3 h-auto rounded-xl bg-zinc-950 hover:bg-zinc-900 transition-colors text-left justify-start cursor-pointer"
    >
      <span className="text-white">{value}</span>
    </Button>
  </div>
);
