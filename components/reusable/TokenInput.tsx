"use client";

interface TokenInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  usdValueLabel: string;
}

const TokenInput = ({
  value,
  onChange,
  onClear,
  usdValueLabel,
}: TokenInputProps) => {
  const getInputFontSize = () => {
    const len = value?.toString().length || 0;
    if (len <= 6) return 36;
    if (len <= 10) return 28;
    if (len <= 14) return 22;
    if (len <= 18) return 16;
    return 12;
  };

  return (
    <div className="text-right relative flex-1 min-w-0 overflow-hidden">
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
          fontSize: `${getInputFontSize()}px`,
          transition: "font-size 0.2s ease",
        }}
        className="bg-transparent font-semibold text-right w-full outline-none text-foreground pr-6 overflow-hidden"
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
