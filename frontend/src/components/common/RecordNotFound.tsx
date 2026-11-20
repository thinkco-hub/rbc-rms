import React from "react";

interface RecordNotFoundProps {
  /** What the URL names, spelled as the screen spells it: "Order", "Client", "Recipe". */
  kind: string;
  id: string;
  onBack: () => void;
}

/**
 * The panel a record URL reaches when this device's array has no such id. There
 * is no store yet, so a reload repopulates from src/data/initial*.ts and any id
 * minted in the previous session is gone — naming it beats a blank content area.
 */
export default function RecordNotFound({ kind, id, onBack }: RecordNotFoundProps) {
  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 mb-4 text-sm font-semibold text-[#562D07]/70 hover:text-[#562D07] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to list
      </button>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 md:p-8">
        <h2 className="text-3xl font-bold text-[#121212]">
          {kind} {id} not found
        </h2>
      </section>
    </div>
  );
}
