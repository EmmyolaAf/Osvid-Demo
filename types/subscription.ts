/**
 * Subscription & Governance Model for OSVID
 * Supports provider governance, deterministic lifecycle status, and safe runtime protection.
 */

export type SubscriptionStatus = "active" | "warning" | "grace" | "suspended";

export type HostingPlan = "standard" | "professional" | "enterprise";

/**
 * Authoritative provider subscription record.
 * Stored exclusively in `system_settings/subscription` (Super Admin access only).
 */
export interface ClientSubscription {
  id?: string;
  clientId: string; // "osvid"
  businessName: string;
  adminEmail?: string;
  adminUid?: string;
  hostingPlan: HostingPlan;
  status: SubscriptionStatus;
  isSuspended: boolean;
  suspendedReason?: string;
  hostingExpiryDate: string; // ISO date string
  startDate?: string;
  gracePeriodDays: number;
  renewalAmountNgn: number;
  lastPaymentDate?: string;
  renewedAt?: string;
  showWarning: boolean;
  warningNotice?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string; // UID or email of actor
  // Provider-private administrative metadata (strictly omitted from client runtime state)
  providerNotes?: string;
  billingContactEmail?: string;
}

/**
 * Minimal safe client-runtime subscription document.
 * Stored in `runtime_settings/subscription` (public read permitted, client writes forbidden).
 * Contains ONLY operational flags required to enforce service state without exposing
 * sensitive provider billing details (no renewal fee, no billing email, no provider notes).
 */
export interface RuntimeSubscriptionState {
  clientId: string;
  isSuspended: boolean;
  suspendedReason?: string;
  hostingExpiryDate: string;
  gracePeriodDays: number;
  hardSuspendAt: any; // Firestore Timestamp for backend rules evaluation
  hardSuspendAtIso: string;
  showWarning: boolean;
  warningNotice?: string;
  updatedAt: string;
  businessName?: string;
}

/**
 * Derived runtime subscription evaluation for UI components.
 */
export interface SubscriptionStatusInfo {
  status: SubscriptionStatus;
  isSuspended: boolean;
  suspendedReason?: string;
  daysRemaining: number;
  hostingExpiryDate: string;
  gracePeriodDays: number;
  isPastDue: boolean;
  isGracePeriod: boolean;
  showWarning: boolean;
  warningNotice?: string;
  businessName?: string;
  hardSuspendAtIso?: string;
  renewalAmountNgn?: number; // Only populated for Super Admin view via system_settings/subscription
  hostingPlan?: HostingPlan;
}
