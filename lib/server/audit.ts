import { adminDb } from "@/lib/firebase/admin";
import { AuditLogEntry, AuditLogCreateInput } from "@/types/audit";
import { OSVID_CLIENT_CONFIG } from "@/config/client";

const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "credential",
  "key",
  "paystack_secret",
  "paystacksecret",
  "apikey",
]);

export interface AuditLogResult {
  success: boolean;
  logId?: string;
  error?: string;
}

/**
 * Recursively sanitizes metadata to ensure no sensitive credentials, secrets, or tokens
 * are persisted in audit trails.
 */
export function sanitizeMetadata(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeMetadata);
  }

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = Array.from(SENSITIVE_KEYS).some((k) => lowerKey.includes(k));
    if (isSensitive) {
      clean[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      clean[key] = sanitizeMetadata(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Constructs an immutable audit record and document reference without writing.
 * Used for atomic Firestore batch commits alongside business document mutations.
 */
export function buildAuditLogRecord(input: AuditLogCreateInput): {
  docRef: FirebaseFirestore.DocumentReference;
  entry: AuditLogEntry;
} {
  const docRef = adminDb.collection("audit_logs").doc();
  const now = new Date().toISOString();

  const entry: AuditLogEntry = {
    id: docRef.id,
    clientId: input.clientId || OSVID_CLIENT_CONFIG.clientId,
    timestamp: now,
    actorUid: input.actor.uid,
    actorEmail: input.actor.email,
    actorRole: input.actor.role,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    summary: input.summary,
    metadata: input.metadata ? sanitizeMetadata(input.metadata) : undefined,
  };

  return { docRef, entry };
}

/**
 * Appends an immutable audit log record to Cloud Firestore via Firebase Admin SDK.
 * Returns structured result indicating success or failure.
 */
export async function logAuditEvent(input: AuditLogCreateInput): Promise<AuditLogResult> {
  try {
    const { docRef, entry } = buildAuditLogRecord(input);
    await docRef.set(entry);
    return { success: true, logId: docRef.id };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error("AUDIT WARNING: Failed to record audit log:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Fetches recent audit logs for Super Admin inspection (newest first).
 */
export async function getRecentAuditLogs(limitCount = 100): Promise<AuditLogEntry[]> {
  try {
    const snapshot = await adminDb
      .collection("audit_logs")
      .orderBy("timestamp", "desc")
      .limit(limitCount)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<AuditLogEntry, "id">),
    }));
  } catch (err: any) {
    console.error("Failed to fetch audit_logs:", err?.message || err);
    return [];
  }
}
