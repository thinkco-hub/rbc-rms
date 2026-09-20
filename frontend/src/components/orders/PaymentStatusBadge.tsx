import React from "react";
import type { PaymentStatus } from "../../types/domain";

export default function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const style =
    status === "Paid"
      ? "text-green-700 border-green-300 bg-green-50"
      : status === "Partial"
      ? "text-amber-700 border-amber-300 bg-amber-50"
      : "text-gray-700 border-gray-300 bg-gray-50";
  return (
    <span
      className={`px-3 py-1 rounded-full border text-xs font-medium flex items-center w-max ${style}`}
    >
      <span className="text-[10px] mr-1.5 leading-none">●</span> {status}
    </span>
  );
}
