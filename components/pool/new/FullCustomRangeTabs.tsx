"use client";

type RangeMode = "full" | "custom";

interface FullCustomRangeTabsProps {
  value: RangeMode;
  onChange: (value: RangeMode) => void;
}

export default function FullCustomRangeTabs({
  value,
  onChange,
}: FullCustomRangeTabsProps) {
  const tabs: { id: RangeMode; label: string }[] = [
    { id: "full", label: "Full range" },
    // Custom range temporarily disabled ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â full range only for now
    // { id: "custom", label: "Custom range" },
  ];

  return (
    <div className="h-[38px] w-full rounded-[18px] border border-border p-1">
      <div className={`grid h-full ${tabs.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {tabs.map((tab) => {
          const isActive = value === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`h-full rounded-[14px] text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary/21 text-primary"
                  : "bg-transparent text-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
