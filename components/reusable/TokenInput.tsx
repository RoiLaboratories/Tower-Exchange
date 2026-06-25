"use client";

import { useRef, useLayoutEffect, useState } from "react";

interface TokenInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  usdValueLabel: string;
}

const MAX_FONT_SIZE = 36;
const MIN_FONT_SIZE = 10;

const TokenInput = ({
  value,
  onChange,
  onClear,
  usdValueLabel,
}: TokenInputProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(MAX_FONT_SIZE);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const mirror = mirrorRef.current;
    if (!container || !mirror) return;

    // Available width: container minus the clear-button space (24px)
    const hasClear = value !== "0.00" && value !== "";
    const availableWidth = container.clientWidth - (hasClear ? 28 : 4);

    // Binary-search for the largest font size that fits
    let lo = MIN_FONT_SIZE;
    let hi = MAX_FONT_SIZE;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      mirror.style.fontSize = `${mid}px`;
      if (mirror.scrollWidth <= availableWidth) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    setFontSize(lo);
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="relative ml-auto flex-1 basis-0 min-w-0 max-w-full text-right overflow-hidden"
    >
      {/* Hidden mirror used to measure rendered text width */}
      <span
        ref={mirrorRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          top: -9999,
          left: -9999,
          visibility: "hidden",
          whiteSpace: "nowrap",
          fontWeight: 600,
          fontFamily: "inherit",
          pointerEvents: "none",
        }}
      >
        {value || "0.00"}
      </span>

      <style jsx>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
          appearance: textfield;
        }
      `}</style>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          if (value === "0.00") onChange("");
          e.target.select();
        }}
        onBlur={() => {
          if (value === "") onChange("0.00");
        }}
        style={{
          fontSize: `${fontSize}px`,
          height: `${MAX_FONT_SIZE + 4}px`,
          transition: "font-size 0.15s ease",
        }}
        className="block w-full min-w-0 bg-transparent pr-6 text-right font-semibold text-foreground outline-none"
        placeholder="0.00"
      />
      {value !== "0.00" && value !== "" && (
        <button
          onClick={onClear}
          className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-lg"
        >
          ×
        </button>
      )}
      <p className="text-sm text-muted-foreground truncate">{usdValueLabel}</p>
    </div>
  );
};

export default TokenInput;
