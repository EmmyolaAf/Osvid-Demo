/**
 * Immutable Audit Log Types
 * Recorded in the append-only `audit_logs` collection.
 */

export type AuditTargetType = "admin" | "manager" | "subscription" | "system" | "product" | "order" | "inventory";

export interface AuditLogEntry {
  id: string;
  clientId: string; // "osvid"
  timestamp: string; // ISO string
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  summary: string;
  metadata?: Record<string, any>;
}

export interface AuditLogCreateInput {
  clientId?: string;
  actor: {
    uid: string;
    email: string;
    role: string;
  };
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  summary: string;
  metadata?: Record<string, any>;
}
