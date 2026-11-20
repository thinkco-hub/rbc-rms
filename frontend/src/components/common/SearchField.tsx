import React from "react";
import { SearchIcon } from "../icons";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
}

/**
 * Borderless search input for a white card. The icon floats over the input's
 * left padding, so the ring on the input already encloses both.
 */
export default function SearchField({ value, onChange, placeholder, ariaLabel }: SearchFieldProps) {
  return (
    <div className="relative flex-1 w-full">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
      >
        <SearchIcon className="h-5 w-5 text-gray-500" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className="block w-full pl-10 pr-3 py-2 rounded-lg text-sm text-gray-900 placeholder-gray-500 bg-transparent outline-none focus:ring-2 focus:ring-[#B45309]"
      />
    </div>
  );
}
