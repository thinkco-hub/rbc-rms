import type { AuditActionType, AuditLogEntry, UserId, UserRole } from "../types/domain";

const AUDIT_LOG_KEY = "bakery.auditLog";
/** Cap total stored entries; oldest are dropped first. Portfolio-scale, not enterprise retention. */
const MAX_ENTRIES = 500;

function loadLog(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLog(entries: AuditLogEntry[]) {
  try {
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage errors (quota exceeded, private browsing) — matches useAuth's pattern
  }
}

export interface RecordAuditEventInput {
  userId: UserId | null;
  userName: string;
  userRole: UserRole | null;
  action: AuditActionType;
  entityType?: string;
  entityId?: string;
  details?: string;
}

/** Appends one entry to the audit log, capping storage at MAX_ENTRIES (drops oldest). */
export function recordAuditEvent(input: RecordAuditEventInput): void {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...input,
  };
  const next = [...loadLog(), entry].slice(-MAX_ENTRIES);
  saveLog(next);
}

/** Reads the full stored log, newest first. */
export function getAuditLog(): AuditLogEntry[] {
  return [...loadLog()].reverse();
}
