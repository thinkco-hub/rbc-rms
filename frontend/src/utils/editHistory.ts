import type { EditHistoryEntry, FieldEdit } from "../types/domain";

/** Records a from -> to change when the trimmed value actually differs. */
export function diffField(field: string, label: string, from: string, to: string): FieldEdit | null {
  const trimmedFrom = from.trim();
  const trimmedTo = to.trim();
  if (trimmedFrom === trimmedTo) return null;
  return { field, label, from: trimmedFrom || "(none)", to: trimmedTo || "(cleared)" };
}

export function diffLines<T>(
  field: string,
  label: string,
  from: T[],
  to: T[],
  describe: (line: T) => string
): FieldEdit | null {
  const summary = (lines: T[]) =>
    lines.length === 0 ? "(no items)" : lines.map((l) => describe(l)).join(", ");
  return diffField(field, label, summary(from), summary(to));
}

/** New change list to append to a record's history; empty input yields no entry. */
export function buildEditHistoryEntry(userName: string, changes: FieldEdit[]): EditHistoryEntry {
  return {
    id: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    userName,
    changes,
  };
}
