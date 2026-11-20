import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  formatDate,
  formatDateTime,
  formatDayLabel,
  formatMonthLabel,
  formatWeekLabel,
  getWeekRange,
  monthKey,
  monthKeyOf,
  parseISODate,
  shiftDayRange,
  shiftMonthKey,
  shiftWeekRange,
  toISODate,
  todayISO,
} from "./dates";

describe("business day keys are local calendar dates", () => {
  it("keeps 23:59 on its own day", () => {
    expect(todayISO(new Date(2026, 9, 30, 23, 59))).toBe("2026-10-30");
  });

  it("rolls to the next day at 00:01", () => {
    expect(todayISO(new Date(2026, 9, 31, 0, 1))).toBe("2026-10-31");
  });

  it("splits the local year boundary into two days", () => {
    expect(todayISO(new Date(2026, 0, 1, 23, 59))).toBe("2026-01-01");
    expect(todayISO(new Date(2026, 0, 2, 0, 1))).toBe("2026-01-02");
  });

  it("parses an ISO date without drifting through UTC", () => {
    const date = parseISODate("2026-10-25");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(25);
    expect(toISODate(date)).toBe("2026-10-25");
  });

  it("moves across month and year ends", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("month keys", () => {
  it("reads the local month, including New Year midnight", () => {
    expect(monthKey(new Date(2026, 0, 1, 0, 1))).toBe("2026-01");
    expect(monthKey(new Date(2026, 11, 31, 23, 59))).toBe("2026-12");
    expect(monthKeyOf("2026-10-31")).toBe("2026-10");
  });

  it("shifts across year boundaries", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
  });

  it("labels the month", () => {
    expect(formatMonthLabel("2026-10")).toBe("October 2026");
  });
});

describe("period labels", () => {
  it("runs weeks Monday to Sunday", () => {
    expect(getWeekRange("2026-10-28")).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(getWeekRange("2026-11-01")).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(formatWeekLabel({ start: "2026-10-26", end: "2026-11-01" })).toBe(
      "Week of Oct 26 – Nov 1, 2026"
    );
  });

  it("labels a day and shifts periods over month ends", () => {
    expect(formatDayLabel("2026-10-25")).toContain("Oct 25, 2026");
    expect(shiftDayRange({ start: "2026-10-31", end: "2026-10-31" }, 1).start).toBe("2026-11-01");
    expect(shiftWeekRange({ start: "2026-10-26", end: "2026-11-01" }, 1)).toEqual({
      start: "2026-11-02",
      end: "2026-11-08",
    });
  });

  it("formats a calendar date and a timestamp in local time", () => {
    expect(formatDate("2026-10-25")).toBe("October 25, 2026");
    expect(formatDate(new Date(2026, 9, 25))).toBe("October 25, 2026");
    const stamp = new Date(2026, 9, 25, 14, 5, 6);
    expect(formatDateTime(stamp)).toBe(stamp.toLocaleString());
  });
});
