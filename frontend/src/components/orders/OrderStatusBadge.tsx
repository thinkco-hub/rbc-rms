import React from "react";
import type { OrderStatus } from "../../types/domain";

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const style =
    status === "Pending"
      ? "text-blue-700 border-blue-300 bg-blue-50"
      : status === "Ready"
      ? "text-green-700 border-green-300 bg-green-50"
      : status === "In Production"
      ? "text-[#562D07] border-[#562D07]/30 bg-[#562D07]/5"
      : "text-gray-700 border-gray-300 bg-gray-50";
  return (
    <span
      className={`px-3 py-1 rounded-full border text-xs font-medium flex items-center w-max ${style}`}
    >
      <span className="text-[10px] mr-1.5 leading-none">●</span> {status}
    </span>
  );
}
