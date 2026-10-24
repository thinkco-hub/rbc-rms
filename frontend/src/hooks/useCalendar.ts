import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../api/client";

export type CalendarItemType = "production_run" | "delivery" | "restock_reminder";
export type CalendarSyncStatus = "active" | "deleted" | "failed" | "not_synced";

export interface CalendarConnection {
  configured: boolean;
  connected: boolean;
  google_email: string;
  calendar_id: string;
  connected_at: string | null;
  failed_count: number;
  can_manage: boolean;
}

export interface CalendarItem {
  type: CalendarItemType;
  reference_id: number;
  date: string;
  title: string;
  status: string;
  sync_status: CalendarSyncStatus;
  html_link: string;
  sync_error: string;
  order_id?: number;
  assigned_staff?: string;
}

interface ResyncResult extends CalendarConnection {
  synced: number;
  removed: number;
  failed: number;
}

export interface CalendarNotice {
  kind: "success" | "error";
  text: string;
}

const errorText = (error: unknown) => {
  if (error instanceof ApiError) {
    const details = error.details as { detail?: string | string[] } | string;
    if (typeof details === "string") return details;
    const detail = details?.detail;
    return Array.isArray(detail) ? detail.join(" ") : detail || `Request failed (${error.status}).`;
  }
  return "Could not reach the server.";
};

/** Reads (and strips) the ?calendar= result the OAuth callback redirects back with. */
function consumeOAuthResult(): CalendarNotice | null {
  const params = new URLSearchParams(window.location.search);
  const result = params.get("calendar");
  if (!result) return null;
  const message = params.get("calendar_message");
  params.delete("calendar");
  params.delete("calendar_message");
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  return result === "connected"
    ? { kind: "success", text: "Google Calendar connected. Upcoming schedules have been synced." }
    : { kind: "error", text: message || "Could not connect Google Calendar." };
}

/**
 * Owns the Google Calendar integration (FR-3.6): connection state, the
 * connect/disconnect/resync actions and the schedule shown for a date range.
 */
export function useCalendar(rangeStart: string, rangeEnd: string) {
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [items, setItems] = useState<CalendarItem[]>([]);
  // Loading is derived: the range is loading until its fetch settles.
  const rangeKey = `${rangeStart}|${rangeEnd}`;
  const [settledRangeKey, setSettledRangeKey] = useState<string | null>(null);
  const isLoading = settledRangeKey !== rangeKey;
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<CalendarNotice | null>(() => consumeOAuthResult());

  const fetchSchedule = useCallback(async () => {
    const query = new URLSearchParams({ start: rangeStart, end: rangeEnd });
    const data = await api.get<{ items: CalendarItem[] }>(`/api/v1/calendar/schedule/?${query}`);
    return data.items;
  }, [rangeStart, rangeEnd]);
  const loadSchedule = async () => setItems(await fetchSchedule());

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get<CalendarConnection>("/api/v1/calendar/connection/"), fetchSchedule()])
      .then(([conn, scheduleItems]) => {
        if (cancelled) return;
        setConnection(conn);
        setItems(scheduleItems);
      })
      .catch((error) => {
        if (!cancelled) setNotice({ kind: "error", text: errorText(error) });
      })
      .finally(() => {
        if (!cancelled) setSettledRangeKey(rangeKey);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchSchedule, rangeKey]);

  const connect = async () => {
    setIsBusy(true);
    try {
      const { authorization_url } = await api.post<{ authorization_url: string }>(
        "/api/v1/calendar/connect/",
        {}
      );
      window.location.assign(authorization_url);
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error) });
      setIsBusy(false);
    }
  };

  const disconnect = async () => {
    setIsBusy(true);
    try {
      setConnection(await api.post<CalendarConnection>("/api/v1/calendar/disconnect/", {}));
      await loadSchedule();
      setNotice({ kind: "success", text: "Google Calendar disconnected." });
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error) });
    } finally {
      setIsBusy(false);
    }
  };

  const resync = async () => {
    setIsBusy(true);
    try {
      const { synced, removed, failed, ...conn } = await api.post<ResyncResult>(
        "/api/v1/calendar/resync/",
        {}
      );
      setConnection(conn);
      await loadSchedule();
      setNotice(
        failed
          ? { kind: "error", text: `Synced ${synced}, removed ${removed}; ${failed} failed — try again shortly.` }
          : { kind: "success", text: `Synced ${synced} event${synced === 1 ? "" : "s"}${removed ? `, removed ${removed}` : ""}.` }
      );
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error) });
    } finally {
      setIsBusy(false);
    }
  };

  return {
    connection,
    items,
    isLoading,
    isBusy,
    notice,
    dismissNotice: () => setNotice(null),
    connect,
    disconnect,
    resync,
  };
}
