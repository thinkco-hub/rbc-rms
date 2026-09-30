import type { ChangeEvent } from "react";
import { useState } from "react";

const INTEGER_PATTERN = /^-?\d*$/;
const DECIMAL_PATTERN = /^-?\d*\.?\d*$/;

interface NumericFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  min?: string;
  placeholder?: string;
  className?: string;
  /** Allow a decimal point (default true). Set false for integer-only fields. */
  allowDecimal?: boolean;
  id?: string;
  disabled?: boolean;
}

/**
 * Numeric text input that blocks non-numeric keystrokes and highlights
 * itself (red border + inline message) when an invalid character is typed,
 * instead of silently ignoring it like a native <input type="number">.
 */
export default function NumericField({
  value,
  onChange,
  label,
  required,
  min = "0",
  placeholder,
  className = "",
  allowDecimal = true,
  id,
  disabled,
}: NumericFieldProps) {
  const [error, setError] = useState("");

  const pattern = allowDecimal ? DECIMAL_PATTERN : INTEGER_PATTERN;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    if (next === "" || pattern.test(next)) {
      setError("");
      onChange(next);
    } else {
      setError(allowDecimal ? "Numbers only" : "Whole numbers only");
    }
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor={id}>
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={value}
        onChange={handleChange}
        min={min}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 outline-none text-gray-800 transition-colors ${
          error
            ? "border-red-500 bg-red-50 focus:ring-red-400 focus:border-red-500"
            : "border-gray-300 focus:ring-[#F17D0C] focus:border-[#F17D0C]"
        } ${className}`}
      />
      {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
