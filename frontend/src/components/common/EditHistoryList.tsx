import React from "react";
import { formatDateTime } from "../../utils/dates";
import type { EditHistoryEntry } from "../../types/domain";

/** Chronological list of edit entries with from -> to per changed field. */
export default function EditHistoryList({ entries }: { entries: EditHistoryEntry[] }) {
  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">
            {formatDateTime(entry.at)} · {entry.userName}
          </p>
          <ul className="space-y-1.5 text-sm">
            {entry.changes.map((change) => (
              <li key={change.field} className="text-gray-800">
                <span className="font-semibold">{change.label}: </span>
                <span className="text-gray-500 line-through">{change.from}</span>
                <span className="mx-1.5 text-gray-500">&rarr;</span>
                <span className="font-medium text-[#562D07]">{change.to}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
