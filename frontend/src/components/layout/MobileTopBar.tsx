import React from "react";

interface MobileTopBarProps {
  onOpenMobileNav: () => void;
  onSwitchView: () => void;
}

export default function MobileTopBar({
  onOpenMobileNav,
  onSwitchView,
}: MobileTopBarProps) {
  return (
    <div className="md:hidden bg-[#562D07] text-[#FDF9F3] p-4 flex justify-between items-center shadow-md z-30">
      <button
        onClick={onOpenMobileNav}
        className="p-2 focus:outline-none bg-[#F3B978]/20 rounded-md"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
      <button
        onClick={onSwitchView}
        className="flex items-center"
        title="Switch to Chams Branch Stock Ledger"
      >
        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center mr-2 p-1">
          <span className="text-[#562D07] font-bold text-xs">RBC</span>
        </div>
        <h1 className="text-lg font-bold">Bakery HQ</h1>
      </button>
    </div>
  );
}