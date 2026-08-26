"use client";
import { motion } from "framer-motion";
import { X } from "lucide-react";

const frequencies = [
  { value: "hourly", label: "Hourly", description: "Every hour starting now" },
  { value: "daily", label: "Daily", description: "Every day starting today" },
  { value: "weekly", label: "Weekly", description: "Every week starting now" },
  { value: "monthly", label: "Monthly", description: "Every month starting now" },
];

interface FrequencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (frequency: string) => void;
  currentValue: string;
}

export const FrequencyModal = ({
  isOpen,
  onClose,
  onSelect,
  currentValue,
}: FrequencyModalProps) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-2xl w-full max-w-md border border-border"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-foreground">
              Select Buy Frequency
            </h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            {frequencies.map((freq) => (
              <button
                key={freq.value}
                onClick={() => {
                  onSelect(freq.label);
                  onClose();
                }}
                className={`w-full px-4 py-4 rounded-xl text-left transition-colors cursor-pointer ${
                  currentValue === freq.label
                    ? "bg-accent"
                    : "bg-secondary hover:bg-accent"
                }`}
              >
                <div className="text-foreground font-medium mb-1">{freq.label}</div>
                <div className="text-muted-foreground text-sm">{freq.description}</div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
