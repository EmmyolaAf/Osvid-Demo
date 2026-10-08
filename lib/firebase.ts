/**
 * Client-Side Firebase Configuration Resolver
 *
 * Direct literal process.env.NEXT_PUBLIC_* references are strictly used so
 * Next.js bundler inlines them into the client bundle during `next build`.
 *
 * Fail-Closed Semantics:
 * - In production (NODE_ENV === "production"): All required public Firebase fields
 *   must be explicitly supplied at build time. Throws clear configuration error if missing.
 *   Never silently falls back to production or another environment.
 * - In non-production (development / test): Safe demo/local fallbacks are provided.
 */

export interface ClientFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export function resolveClientFirebaseConfig(
  overrides?: Partial<ClientFirebaseConfig>,
  nodeEnv: string = process.env.NODE_ENV || "development"
): ClientFirebaseConfig {
  // Direct literal references for Next.js bundler static analysis / inlining
  const envConfig: Partial<ClientFirebaseConfig> = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  const config: Partial<ClientFirebaseConfig> = {
    ...envConfig,
    ...overrides,
  };

  const isProduction = nodeEnv === "production";

  const requiredFields: Array<keyof Omit<ClientFirebaseConfig, "measurementId">> = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
  ];

  const missing = requiredFields.filter((key) => !config[key] || !config[key]!.trim());

  if (isProduction && missing.length > 0) {
    throw new Error(
      `Missing required client Firebase configuration: ${missing.join(", ")}. ` +
      `In production and staging environments, NEXT_PUBLIC_FIREBASE_* variables must be explicitly supplied at build time. ` +
      `Never silently default to production in staging or unconfigured builds.`
    );
  }

  // Non-production fallback for local development and unit tests
  const resolved: ClientFirebaseConfig = {
    apiKey: config.apiKey?.trim() || "demo-api-key",
    authDomain: config.authDomain?.trim() || `${config.projectId?.trim() || "demo-osvid-rules-test"}.firebaseapp.com`,
    projectId: config.projectId?.trim() || "demo-osvid-rules-test",
    storageBucket: config.storageBucket?.trim() || `${config.projectId?.trim() || "demo-osvid-rules-test"}.firebasestorage.app`,
    messagingSenderId: config.messagingSenderId?.trim() || "123456789012",
    appId: config.appId?.trim() || "1:123456789012:web:demoappid",
    measurementId: config.measurementId?.trim() || undefined,
  };

  return resolved;
}

export const firebaseConfig = resolveClientFirebaseConfig();
