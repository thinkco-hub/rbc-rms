import type { DateRange, ISODate, ISODateTime, MonthKey } from "../types/domain";

/**
 * Business dates are local calendar dates. toISOString() slices the UTC day,
 * which is still yesterday in UTC+8 between 00:00 and 08:00, so every day key
 * here is built from local getters instead.
 */
export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(clock: Date = new Date()): ISODate {
  return toISODate(clock);
}

export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysISO(iso: ISODate, delta: number): ISODate {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + delta);
  return toISODate(date);
}

export function monthKey(date: Date = new Date()): MonthKey {
  return toISODate(date).slice(0, 7);
}

export function monthKeyOf(iso: ISODate): MonthKey {
  return iso.slice(0, 7);
}

export function shiftMonthKey(key: MonthKey, delta: number): MonthKey {
  const [y, m] = key.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Weeks run Monday–Sunday (ISO).
export function getWeekRange(anchorISO: ISODate): DateRange {
  const date = parseISODate(anchorISO);
  const day = date.getDay(); // 0 = Sun ... 6 = Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + offsetToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toISODate(start), end: toISODate(end) };
}

// A day period is the single date itself.
export function getDayRange(anchorISO: ISODate): DateRange {
  return { start: anchorISO, end: anchorISO };
}

export function getMonthRange(key: MonthKey): DateRange {
  const [y, m] = key.split("-").map(Number);
  return {
    start: toISODate(new Date(y, m - 1, 1)),
    end: toISODate(new Date(y, m, 0)),
  };
}

export function shiftWeekRange(range: DateRange, delta: number): DateRange {
  return getWeekRange(addDaysISO(range.start, delta * 7));
}

export function shiftDayRange(range: DateRange, delta: number): DateRange {
  return getDayRange(addDaysISO(range.start, delta));
}

// ---- Labels ----

/** A calendar date for display, e.g. "October 31, 2026". */
export function formatDate(value: Date | ISODate = new Date()): string {
  const date = value instanceof Date ? value : parseISODate(value);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** A full timestamp in the viewer's local time. */
export function formatDateTime(value: ISODateTime | Date): string {
  return new Date(value).toLocaleString();
}

export function formatWeekLabel(range: DateRange): string {
  const start = parseISODate(range.start);
  const end = parseISODate(range.end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `Week of ${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString(
    "en-US",
    { ...opts, year: "numeric" }
  )}`;
}

export function formatMonthLabel(key: MonthKey): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function formatDayLabel(iso: ISODate): string {
  return parseISODate(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
