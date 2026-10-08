/**
 * Server Environment and Secret Contract
 *
 * Validates and provides typed access to server-side environment variables.
 * Enforces security rules:
 * 1. Server secrets must never be exposed to the client or prefixed with NEXT_PUBLIC_.
 * 2. Missing provider secrets fail with explicit descriptive errors during runtime operations.
 */

export interface ServerEnvironmentContract {
  // Server Secrets
  paystackSecretKey: string | undefined;
  resendApiKey: string | undefined;
  maintenanceCronSecret: string | undefined;

  // Server Non-Secrets
  firebaseProjectId: string;
  fromEmail: string | undefined;
  bccEmail: string | undefined;
  nodeEnv: "development" | "test" | "production";
  port: number;
  maintenanceMode: boolean;

  // Public Configuration
  publicBaseUrl: string | undefined;
}

/**
 * Validates that no secret variable has been accidentally leaked via NEXT_PUBLIC_
 */
export function assertNoExposedSecrets(): void {
  const forbiddenPrefixes = [
    "NEXT_PUBLIC_PAYSTACK_SECRET",
    "NEXT_PUBLIC_PAYSTACK_KEY",
    "NEXT_PUBLIC_RESEND_API",
    "NEXT_PUBLIC_RESEND_KEY",
    "NEXT_PUBLIC_MAINTENANCE_CRON_SECRET",
    "NEXT_PUBLIC_FIREBASE_SERVICE_ACCOUNT",
  ];

  for (const key of Object.keys(process.env)) {
    for (const forbidden of forbiddenPrefixes) {
      if (key.toUpperCase().startsWith(forbidden)) {
        throw new Error(
          `SECURITY CRITICAL: Server secret detected with public prefix "${key}". Remove immediately to prevent client-side exposure.`
        );
      }
    }
  }
}

/**
 * Resolves the server environment configuration with defaults and validations
 */
export function getServerConfig(): ServerEnvironmentContract {
  assertNoExposedSecrets();

  const nodeEnv = (process.env.NODE_ENV as "development" | "test" | "production") || "development";
  const port = parseInt(process.env.PORT || "8080", 10);
  const firebaseProjectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "osvid-9d4d6";

  return {
    paystackSecretKey: process.env.PAYSTACK_SECRET_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    maintenanceCronSecret: process.env.MAINTENANCE_CRON_SECRET,
    firebaseProjectId,
    fromEmail: process.env.FROM_EMAIL,
    bccEmail: process.env.BCC_EMAIL,
    nodeEnv,
    port: isNaN(port) ? 8080 : port,
    maintenanceMode: process.env.MAINTENANCE_MODE === "true",
    publicBaseUrl: process.env.NEXT_PUBLIC_BASE_URL,
  };
}

/**
 * Validates and retrieves the Paystack Secret Key.
 * Throws a descriptive configuration error if missing.
 */
export function requirePaystackSecret(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !key.trim()) {
    throw new Error(
      "Configuration Error: PAYSTACK_SECRET_KEY is missing. Payment and refund operations cannot proceed."
    );
  }
  return key.trim();
}

/**
 * Validates and retrieves the Resend API Key.
 * Throws a descriptive configuration error if missing.
 */
export function requireResendApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key || !key.trim()) {
    throw new Error(
      "Configuration Error: RESEND_API_KEY is missing. Transactional email operations cannot proceed."
    );
  }
  return key.trim();
}

/**
 * Validates and retrieves the Maintenance Cron Secret.
 * Throws a descriptive configuration error if missing.
 */
export function requireMaintenanceCronSecret(): string {
  const secret = process.env.MAINTENANCE_CRON_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error(
      "Configuration Error: MAINTENANCE_CRON_SECRET is missing. Maintenance execution is disabled."
    );
  }
  return secret.trim();
}
