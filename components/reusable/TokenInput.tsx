"use client";
import { useState } from "react";

interface TokenInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

const TokenInput = ({ value, onChange, onClear }: TokenInputProps) => {
  const [isFocused, setIsFocused] = useState(false);

  // Dynamic font size based on input length - scales down much more aggressively
  const getInputFontSize = (inputValue: string) => {
    const length = inputValue.length;
    if (length <= 4) return 36;
    if (length <= 6) return 32;
    if (length <= 8) return 26;
    if (length <= 10) return 22;
    if (length <= 12) return 18;
    if (length <= 15) return 14;
    if (length <= 18) return 12;
    if (length <= 25) return 10;
    return Math.max(8, 36 - (length - 4) * 1.5);
  };

  return (
    <div className="text-right relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          setIsFocused(true);
          if (value === "0.00") {
            onChange("");
          }
          e.target.select();
        }}
        onBlur={() => {
          setIsFocused(false);
          if (value === "") {
            onChange("0.00");
          }
        }}
        style={{
          fontSize: `${getInputFontSize(value)}px`,
          transition: "font-size 0.2s ease",
        }}
        className="bg-transparent font-semibold text-right w-56 outline-none text-foreground pr-6"
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
      <p className="text-sm text-muted-foreground">~$0</p>
    </div>
  );
};

export default TokenInput;
