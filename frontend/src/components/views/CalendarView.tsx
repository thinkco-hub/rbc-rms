import React, { useMemo, useState } from "react";
import { CalendarIcon } from "../icons";
import {
  useCalendar,
  type CalendarItem,
  type CalendarItemType,
  type CalendarSyncStatus,
} from "../../hooks/useCalendar";

const TYPE_STYLES: Record<CalendarItemType, { label: string; chip: string; dot: string }> = {
  production_run: { label: "Production", chip: "bg-[#F17D0C]/15 text-[#9A4A00]", dot: "bg-[#F17D0C]" },
  delivery: { label: "Delivery", chip: "bg-blue-100 text-blue-800", dot: "bg-blue-500" },
  restock_reminder: { label: "Restock", chip: "bg-red-100 text-red-800", dot: "bg-red-500" },
};

const SYNC_LABELS: Record<CalendarSyncStatus, { text: string; className: string }> = {
  active: { text: "On Google Calendar", className: "text-green-700" },
  failed: { text: "Sync failed", className: "text-red-700" },
  deleted: { text: "Not on calendar", className: "text-[#562D07]/50" },
  not_synced: { text: "Not synced", className: "text-[#562D07]/50" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The 6-week grid (Sunday-first) that contains `month`. */
function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function ItemRow({ item }: { item: CalendarItem }) {
  const type = TYPE_STYLES[item.type];
  const sync = SYNC_LABELS[item.sync_status];
  const done = ["completed", "delivered", "cancelled"].includes(item.status);
  return (
    <li className="flex items-start gap-3 py-2 border-b border-[#F3B978]/40 last:border-0">
      <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${type.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${type.chip}`}>{type.label}</span>
          <span className={`font-medium text-[#562D07] ${done ? "line-through opacity-60" : ""}`}>
            {item.title}
          </span>
        </div>
        <div className="text-xs mt-1 flex flex-wrap gap-x-3">
          <span className="text-[#562D07]/60 capitalize">{item.status.replace("_", " ")}</span>
          {item.assigned_staff && <span className="text-[#562D07]/60">Assigned: {item.assigned_staff}</span>}
          <span className={sync.className} title={item.sync_error || undefined}>
            {sync.text}
          </span>
          {item.html_link && item.sync_status === "active" && (
            <a
              href={item.html_link}
              target="_blank"
              rel="noreferrer"
              className="text-[#F17D0C] font-semibold hover:underline"
            >
              Open in Google
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

export default function CalendarView() {
  const today = isoDate(new Date());
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(today);

  const days = useMemo(() => monthGrid(month), [month]);
  const rangeStart = isoDate(days[0]);
  const rangeEnd = isoDate(days[days.length - 1]);
  const { connection, items, isLoading, isBusy, notice, dismissNotice, connect, disconnect, resync } =
    useCalendar(rangeStart, rangeEnd);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      map.set(item.date, [...(map.get(item.date) || []), item]);
    }
    return map;
  }, [items]);
  const selectedItems = itemsByDate.get(selectedDate) || [];

  const shiftMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const goToday = () => {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(today);
  };

  const buttonBase =
    "px-3 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="max-w-6xl mx-auto flex flex-col animate-fadeIn w-full gap-4 md:gap-6">
      <header>
        <h2 className="text-2xl md:text-3xl font-bold text-[#562D07]">Delivery Scheduler</h2>
        <p className="text-[#562D07]/70 mt-1 font-medium text-sm md:text-base">
          Production runs, deliveries and restock reminders, synced to Google Calendar
        </p>
      </header>

      {notice && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            notice.kind === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={dismissNotice} className="font-bold opacity-60 hover:opacity-100" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {/* Connection card (FR-3.6.1, FR-3.6.6) */}
      <section className="bg-white rounded-lg shadow-sm border border-[#F3B978] p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
        <div className="w-12 h-12 bg-[#F3B978]/20 rounded-full flex items-center justify-center shrink-0">
          <CalendarIcon className="w-6 h-6 text-[#F17D0C]" />
        </div>
        <div className="flex-1 min-w-0">
          {!connection ? (
            <p className="text-[#562D07]/70 text-sm">Checking Google Calendar connection…</p>
          ) : connection.connected ? (
            <>
              <p className="font-bold text-[#562D07]">
                Connected to {connection.google_email || "Google Calendar"}
              </p>
              <p className="text-sm text-[#562D07]/70">
                New and changed schedules sync automatically
                {connection.failed_count > 0 && (
                  <span className="text-red-700 font-semibold">
                    {" "}· {connection.failed_count} item{connection.failed_count === 1 ? "" : "s"} failed to sync
                  </span>
                )}
              </p>
            </>
          ) : (
            <>
              <p className="font-bold text-[#562D07]">Google Calendar not connected</p>
              <p className="text-sm text-[#562D07]/70">
                {!connection.configured
                  ? "The server has no Google OAuth credentials yet. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in the backend .env."
                  : connection.can_manage
                    ? "Connect the business Google account to put production runs, deliveries and restock reminders on its calendar."
                    : "Ask an owner or admin to connect the business Google account."}
              </p>
            </>
          )}
        </div>
        {connection?.can_manage && (
          <div className="flex flex-wrap gap-2">
            {connection.connected ? (
              <>
                <button
                  onClick={resync}
                  disabled={isBusy}
                  className={`${buttonBase} bg-[#F17D0C] text-white hover:bg-[#d96f0a]`}
                >
                  {isBusy ? "Working…" : "Sync now"}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("Disconnect Google Calendar? Events already on the calendar will stay there.")) {
                      disconnect();
                    }
                  }}
                  disabled={isBusy}
                  className={`${buttonBase} border border-[#F3B978] text-[#562D07] hover:bg-[#F3B978]/20`}
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={connect}
                disabled={isBusy || !connection.configured}
                className={`${buttonBase} bg-[#F17D0C] text-white hover:bg-[#d96f0a]`}
              >
                {isBusy ? "Redirecting…" : "Connect Google Calendar"}
              </button>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 md:gap-6">
        {/* Month grid */}
        <section className="bg-white rounded-lg shadow-sm border border-[#F3B978] p-3 md:p-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="text-lg font-bold text-[#562D07]">
              {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </h3>
            <div className="flex gap-1">
              <button onClick={() => shiftMonth(-1)} className={`${buttonBase} text-[#562D07] hover:bg-[#F3B978]/20`} aria-label="Previous month">
                ‹
              </button>
              <button onClick={goToday} className={`${buttonBase} text-[#562D07] hover:bg-[#F3B978]/20`}>
                Today
              </button>
              <button onClick={() => shiftMonth(1)} className={`${buttonBase} text-[#562D07] hover:bg-[#F3B978]/20`} aria-label="Next month">
                ›
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-xs font-semibold text-[#562D07]/60 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className={`grid grid-cols-7 gap-px bg-[#F3B978]/40 rounded overflow-hidden ${isLoading ? "opacity-60" : ""}`}>
            {days.map((day) => {
              const key = isoDate(day);
              const dayItems = itemsByDate.get(key) || [];
              const inMonth = day.getMonth() === month.getMonth();
              const isSelected = key === selectedDate;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={`min-h-14 md:min-h-20 p-1 text-left flex flex-col gap-0.5 transition-colors ${
                    isSelected ? "bg-[#F3B978]/30" : "bg-white hover:bg-[#F3B978]/10"
                  }`}
                >
                  <span
                    className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                      key === today ? "bg-[#F17D0C] text-white" : inMonth ? "text-[#562D07]" : "text-[#562D07]/30"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {/* Dots on small screens, short labels on wider ones */}
                  <div className="flex flex-wrap gap-0.5 md:hidden">
                    {dayItems.slice(0, 4).map((item) => (
                      <span key={`${item.type}-${item.reference_id}`} className={`w-1.5 h-1.5 rounded-full ${TYPE_STYLES[item.type].dot}`} />
                    ))}
                  </div>
                  <div className="hidden md:flex flex-col gap-0.5 w-full">
                    {dayItems.slice(0, 3).map((item) => (
                      <span
                        key={`${item.type}-${item.reference_id}`}
                        className={`truncate text-[10px] leading-4 px-1 rounded ${TYPE_STYLES[item.type].chip}`}
                      >
                        {item.sync_status === "failed" ? "⚠ " : ""}
                        {item.title}
                      </span>
                    ))}
                    {dayItems.length > 3 && (
                      <span className="text-[10px] text-[#562D07]/60 px-1">+{dayItems.length - 3} more</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 mt-3 text-xs text-[#562D07]/70">
            {Object.values(TYPE_STYLES).map((t) => (
              <span key={t.label} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${t.dot}`} />
                {t.label}
              </span>
            ))}
          </div>
        </section>

        {/* Selected day */}
        <section className="bg-white rounded-lg shadow-sm border border-[#F3B978] p-4">
          <h3 className="font-bold text-[#562D07] mb-2">
            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-[#562D07]/60">Nothing scheduled.</p>
          ) : (
            <ul>
              {selectedItems.map((item) => (
                <ItemRow key={`${item.type}-${item.reference_id}`} item={item} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
