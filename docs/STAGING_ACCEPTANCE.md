# OSVID Staging Acceptance & Paystack V2 Verification Guide

This document outlines the staging validation checklist, Paystack Popup V2 manual acceptance gates, and Content Security Policy (CSP) verification before declaring production readiness.

---

## 1. Staging Environment Architecture & Isolation

| Resource | Staging Configuration | Production Isolation Rule |
| :--- | :--- | :--- |
| **Paystack API** | Test Mode (`sk_test_...`, `pk_test_...`) | **NEVER** use live keys in staging. All charges must use Paystack test cards. |
| **Runtime URL** | Staging Cloud Run service or preview domain | Separate runtime revision from production. |
| **Paystack Webhook** | `https://<STAGING_DOMAIN>/api/payment/webhook` | Webhook URL pointed strictly to staging runtime to avoid cross-environment reconciliation. |
| **Resend Emails** | Test sender or sandbox API key | To prevent accidental email blasts to real customers, stage orders using test email addresses only. |
| **Firebase Project** | Dedicated staging Firebase project OR isolated collection namespace | If sharing project `osvid-9d4d6`, tag all test data with `isTest: true` and clear test orders after staging. |

---

## 2. Paystack Popup V2 Staging Acceptance Checklist

Execute the following end-to-end tests in staging before production cutover:

### Flow 1: Standard End-to-End Successful Checkout
- [ ] **1. Cart Assembly & Reservation**: Add in-stock product to cart. Proceed to `/checkout`.
- [ ] **2. Server Initialization**: Submit order details. Browser calls `POST /api/payment/initialize`.
  - Verify server checks operational subscription.
  - Verify server validates server-authoritative pricing and reserves stock in Firestore.
  - Verify server returns `accessCode`, `reference`, and `checkoutRequestId`.
- [ ] **3. Popup V2 Launch**: Browser invokes Paystack Popup V2:
  ```javascript
  const popup = new Paystack();
  popup.resumeTransaction(accessCode);
  ```
  - Verify popup renders over checkout without CSP errors.
- [ ] **4. Test Charge**: Enter Paystack test card (`4084 0840 8408 4084`, any future expiry, any 3-digit CVV, PIN `1234`, OTP `123456`).
- [ ] **5. Client Verification Call**: On `onSuccess` callback, browser calls `POST /api/payment/verify`.
  - Verify order confirmation page loads with authoritative amount and currency.
- [ ] **6. Invariant Verification in Database**:
  - Exactly **one** document created in `orders`.
  - Exactly **one** document created in `payment_transactions`.
  - Exactly **one** `inventory_movements` record of type `sale`.
  - Product `stockQuantity` decremented by ordered units; `reservedQuantity` released.
  - Applied coupon `usedCount` incremented by 1 (if coupon applied).
  - Customer profile metrics (`ordersCount`, `totalSpent`) incremented once for authenticated buyer.
  - Exactly **one** order confirmation email received via Resend.

---

### Flow 2: Tab-Close / Webhook-Only Reconciliation
Tests asynchronous reconciliation when the buyer closes the browser immediately after completing payment at their bank:

- [ ] **1. Initialize & Pay**: Complete card authorization in Paystack popup.
- [ ] **2. Immediate Tab Close**: Force-close the browser tab immediately before the `onSuccess` redirect triggers.
- [ ] **3. Webhook Delivery**: Paystack sends `charge.success` to `/api/payment/webhook`.
  - Verify webhook signature is verified via HMAC SHA-512.
  - Verify `finalizeSuccessfulPayment` executes cleanly in webhook handler.
  - Verify order document is created and inventory is deducted exactly once.
- [ ] **4. Duplicate Client Protection**: Reopen browser to verification URL `/checkout/success?reference=...`.
  - Verify server detects existing finalized order and returns existing order without duplicate stock deduction or email blast.

---

### Flow 3: Idempotent Replay & In-Progress Locking
- [ ] **1. Concurrent Initialization**: Fire two simultaneous `POST /api/payment/initialize` requests with identical `checkoutRequestId`.
  - Verify atomic claim locks the session: exactly **one** Paystack call is made; both requests return matching `accessCode`.
- [ ] **2. Double Webhook Delivery**: Simulate Paystack duplicate webhook delivery.
  - Verify second webhook execution is recognized as already finalized and acknowledges `200 OK` with zero side-effects.

---

### Flow 4: Anomaly & Stock Exhaustion Refund
- [ ] **1. Simulate Intervening Stock Depletion**: After initializing payment, simulate product deletion or coupon removal before payment completes.
- [ ] **2. Pay on Paystack**: Authorize payment on Paystack.
- [ ] **3. Anomaly Handling**: Finalizer detects `anomaly_unfulfillable`.
  - Verify order status is marked `anomaly_unfulfillable`.
  - Verify reserved quantity is released back to inventory pool.
  - Verify system calls Paystack refund API.
  - If refund is accepted, status transitions cleanly to `refunded`.

---

## 3. Security Headers & CSP Staging Acceptance Checklist

Verify in browser developer tools (Console & Network tabs) that no Content Security Policy violations occur during the following user interactions:

- [ ] **Paystack Script**: `https://js.paystack.co/v2/inline.js` loads without CSP script-src blocking.
- [ ] **Paystack Frames**: Paystack modal iframe loads without frame-src blocking.
- [ ] **Firebase Auth**: Google OAuth popup or redirect executes without blocking.
- [ ] **Storage Images**: Media assets from `firebasestorage.googleapis.com` render cleanly across shop and detail pages.
- [ ] **Fonts & Styles**: Google Fonts and Tailwind CSS styles apply without style-src restrictions.
