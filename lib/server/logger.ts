import crypto from "crypto";

/**
 * Structured server logger compatible with Google Cloud Logging / Cloud Run.
 *
 * Emits JSON-formatted structured entries with:
 * - severity (INFO, WARNING, ERROR)
 * - message
 * - request correlation ID (requestId)
 * - commerce identifiers (checkoutSessionId, paystackReference, orderId)
 * - strict redaction for credentials, tokens, and PII.
 */

export interface LogContext {
  requestId?: string;
  checkoutSessionId?: string;
  paystackReference?: string;
  orderId?: string;
  operation?: string;
  outcome?: "success" | "failure" | "anomaly" | "pending" | "skipped" | "in_progress";
  [key: string]: unknown;
}

const REDACTED_KEYS = new Set([
  "authorization",
  "auth",
  "token",
  "idtoken",
  "releasetoken",
  "secret",
  "secretkey",
  "paystacksecretkey",
  "resendapikey",
  "password",
  "serviceaccount",
  "serviceaccountkey",
  "cardnumber",
  "cvv",
  "pin",
]);

/**
 * Recursively sanitize an object to prevent secret or sensitive credential leakage
 */
export function sanitizeLogData(obj: unknown, depth = 0): unknown {
  if (depth > 4 || obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    // Truncate excessively long strings that might contain payloads
    if (obj.length > 500) {
      return `${obj.slice(0, 500)}...[truncated]`;
    }
    return obj;
  }

  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogData(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (REDACTED_KEYS.has(lowerKey)) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitizeLogData(value, depth + 1);
    }
  }
  return sanitized;
}

/**
 * Extracts a safe x-request-id or generates a fresh UUID
 */
export function getOrGenerateRequestId(request?: Request | Headers | null): string {
  if (!request) {
    return crypto.randomUUID();
  }

  const headers = "headers" in request ? request.headers : request;
  const incoming = headers.get("x-request-id")?.trim();

  // Validate format: safe alphanumeric + hyphens + underscores, length <= 64
  if (incoming && /^[a-zA-Z0-9_\-]{1,64}$/.test(incoming)) {
    return incoming;
  }

  return crypto.randomUUID();
}

function emitLog(severity: "INFO" | "WARNING" | "ERROR", message: string, context?: LogContext, error?: unknown) {
  const entry: Record<string, unknown> = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    service: "osvid-web",
  };

  if (context) {
    const cleanContext = sanitizeLogData(context) as Record<string, unknown>;
    Object.assign(entry, cleanContext);
  }

  if (error) {
    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
      };
    } else {
      entry.error = String(error);
    }
  }

  const output = JSON.stringify(entry);

  if (severity === "ERROR") {
    console.error(output);
  } else if (severity === "WARNING") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info(message: string, context?: LogContext) {
    emitLog("INFO", message, context);
  },
  warn(message: string, context?: LogContext) {
    emitLog("WARNING", message, context);
  },
  error(message: string, context?: LogContext, error?: unknown) {
    emitLog("ERROR", message, context, error);
  },
};
