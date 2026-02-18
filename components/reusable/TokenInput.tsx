"use client";

import { useState } from "react";

interface TokenInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

const TokenInput = ({ value, onChange, onClear }: TokenInputProps) => {
  const [isFocused, setIsFocused] = useState(false);

  // Fixed font size - no scaling based on input length
  const getInputFontSize = () => {
    return 36;
  };

  return (
    <div className="text-right relative flex-1 min-w-0">
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
          fontSize: `${getInputFontSize()}px`,
          transition: "font-size 0.2s ease",
        }}
        className="bg-transparent font-semibold text-right w-full outline-none text-foreground pr-6"
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
