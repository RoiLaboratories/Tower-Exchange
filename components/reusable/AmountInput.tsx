"use client";

interface AmountInputProps {
  amount: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

export const AmountInput = ({
  amount,
  onChange,
  readOnly = false,
}: AmountInputProps) => (
  <div className="bg-black rounded-xl p-4">
    <input
      type="text"
      value={`$${amount}`}
      onChange={
        onChange ? (e) => onChange(e.target.value.replace("$", "")) : undefined
      }
      readOnly={readOnly}
      className="w-full bg-transparent text-3xl font-semibold text-white outline-none text-center"
    />
  </div>
);
