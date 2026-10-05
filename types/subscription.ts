/**
 * Subscription & Governance Model for OSVID
 * Supports provider governance, deterministic lifecycle status, and runtime protection.
 */

export type SubscriptionStatus = "active" | "warning" | "grace" | "suspended";

export type HostingPlan = "standard" | "professional" | "enterprise";

export interface ClientSubscription {
  id?: string;
  clientId: string; // "osvid"
  businessName: string;
  adminEmail: string;
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
  // Provider-private administrative metadata (not exposed in client runtime state)
  providerNotes?: string;
  billingContactEmail?: string;
}

/**
 * Minimal safe client-runtime subscription status representation.
 * Exposes only operational flags required to gate features without exposing sensitive provider metadata.
 */
export interface RuntimeSubscriptionState {
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
  renewalAmountNgn: number;
  hostingPlan: HostingPlan;
  businessName: string;
}
