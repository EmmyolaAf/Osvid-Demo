# OSVID Production Deployment Runbook & Operations Guide

This runbook documents the release sequence, infrastructure configuration, secret contracts, and operational playbooks for the OSVID dynamic production runtime.

---

## 1. Production Architecture Overview

- **Front Door**: Firebase Hosting (`site: "osvid"`)
  - Serves static assets from `public/` and immutable bundles (`/_next/static/**`) with aggressive edge caching.
  - Enforces `Cache-Control: no-store` on `/api/**`.
  - Rewrites application and API routes to the dynamic Cloud Run service.
- **Application Server**: Google Cloud Run (`serviceId: "osvid-web"`)
  - Multi-stage Docker container running Next.js 16 standalone server (`node server.js`).
  - Listens on `PORT` (8080) as non-root user (`nextjs:1001`).
  - Authenticates to Firebase Firestore via Google Application Default Credentials (ADC).
- **Commerce Providers**:
  - Paystack: Server-authoritative checkout initialization, payment verification, HMAC SHA-512 webhook ingestion, and refund processing.
  - Resend: Transactional customer receipts and operational order notifications.

---

## 2. Infrastructure & Service Account Configuration

### Cloud Run Service Account (Least Privilege)
The Cloud Run service should run with a dedicated Google Cloud service account:
`osvid-web-runtime@osvid-9d4d6.iam.gserviceaccount.com`

**Required IAM Roles (Do NOT grant Owner or Editor):**
1. `roles/datastore.user` — Read and write access to Cloud Firestore documents and transactions.
2. `roles/firebaseauth.admin` (or `roles/identityplatform.admin`) — Verification of Firebase Auth ID tokens and administrative user resolution.
3. `roles/storage.objectViewer` — Read access to Google Cloud Storage assets (if server-side media inspection is required).

### Production Cloud Run Region
> ⚠️ **MANUAL GATE — REGION UNKNOWN LOCALLY**:
> Local developer inspection did not have authenticated access to Google Cloud CLI (`gcloud`).
> **Action Required**: Inspect Google Cloud Console for project `osvid-9d4d6` to confirm Firestore database location (commonly `europe-west1`, `europe-west2`, or `us-central1`).
> Cloud Run service `osvid-web` MUST be provisioned in the same region or low-latency region relative to Firestore.
> Replace `<CLOUD_RUN_REGION_MANUAL_GATE>` in `firebase.hosting-cloudrun.template.json` when deploying Hosting rewrites.

---

## 3. Server Environment & Secret Manager Contract

Configure the following secrets in Google Cloud Secret Manager and mount as environment variables on Cloud Run:

| Variable | Type | Source / Value Description |
| :--- | :--- | :--- |
| `PAYSTACK_SECRET_KEY` | Secret | Live secret key `sk_live_...` from Paystack Dashboard |
| `RESEND_API_KEY` | Secret | Production API key `re_...` from Resend Console |
| `MAINTENANCE_CRON_SECRET` | Secret | Cryptographically random 32+ character hex string |
| `FIREBASE_PROJECT_ID` | Non-Secret | `osvid-9d4d6` |
| `NODE_ENV` | Non-Secret | `production` |
| `FROM_EMAIL` | Non-Secret | Verified sender address (e.g. `orders@osvid.com.ng`) |
| `BCC_EMAIL` | Non-Secret | Internal order notification mailbox (`osvidbusinesses@gmail.com`) |
| `NEXT_PUBLIC_BASE_URL` | Public | Production domain `https://osvid.com.ng` |

---

## 4. Production Deployment Sequence

Follow this exact sequential order to prevent locking operational staff out due to fail-closed subscription security rules.

### Step 1: Provision Cloud Run Service & Secrets
1. Create or update Cloud Run service `osvid-web` with the production container image built from the `Dockerfile`.
2. Attach runtime service account `osvid-web-runtime@osvid-9d4d6.iam.gserviceaccount.com`.
3. Configure environment variables and Secret Manager references.

### Step 2: Deploy & Verify Health Check
1. Deploy the initial Cloud Run revision.
2. Call the public health endpoint:
   ```bash
   curl -i https://<CLOUD_RUN_URL>/api/health
   ```
3. Verify status `200 OK` and response body:
   ```json
   { "status": "ok", "service": "osvid-web", "environment": "production" }
   ```

### Step 3: Initialize Runtime Subscription State
> ⚠️ **CRITICAL ORDER OF OPERATIONS**:
> Firestore Security Rules fail closed if `runtime_settings/subscription` is absent.
> The primary Super Admin (`abolarinwaemmanuelfree@gmail.com`) must ensure this document exists before deploying rules.
1. Super Admin authenticates to admin dashboard or executes provisioning script to verify `runtime_settings/subscription`:
   ```json
   {
     "clientId": "osvid",
     "isSuspended": false,
     "hardSuspendAt": "<FUTURE_TIMESTAMP>"
   }
   ```

### Step 4: Deploy Firestore & Storage Security Rules
Deploy updated security rules:
```bash
firebase deploy --only firestore:rules,storage:rules
```

### Step 5: Update & Deploy Firebase Hosting Rewrite
1. Copy `firebase.hosting-cloudrun.template.json` to `firebase.json` with the verified Cloud Run region replacing `<CLOUD_RUN_REGION_MANUAL_GATE>`.
2. Deploy hosting configuration:
   ```bash
   firebase deploy --only hosting
   ```

### Step 6: Configure Paystack Webhook
1. In the Paystack Dashboard (Live Settings), configure Webhook URL:
   `https://osvid.com.ng/api/payment/webhook`
2. Test webhook ping to confirm signature validation returns `200 OK`.

### Step 7: Configure Scheduled Reservation Cleanup
Create a Google Cloud Scheduler job to periodically release expired checkout reservations:

- **Job Name**: `osvid-cleanup-expired-reservations`
- **Region**: Same as Cloud Run service
- **Schedule**: `*/5 * * * *` (Every 5 minutes)
- **Timezone**: `Africa/Lagos` (UTC+1)
- **Target Type**: HTTP
- **URL**: `https://osvid.com.ng/api/internal/maintenance/checkout-reservations`
- **HTTP Method**: `POST`
- **HTTP Headers**:
  - `Authorization`: `Bearer <MAINTENANCE_CRON_SECRET>`
  - `Content-Type`: `application/json`
- **Retry Policy**:
  - Max retry attempts: 3
  - Min backoff duration: 10s
  - Max backoff duration: 60s

---

## 5. Rollback Procedures

### Application Code Rollback
If a defect is identified in application logic:
1. In Google Cloud Console -> Cloud Run -> `osvid-web` -> Revisions.
2. Shift 100% traffic immediately to the previous known-good revision.
3. Identify the git commit hash associated with the failing revision via container image tag.

### Hosting Rewrite Rollback
```bash
firebase hosting:rollback
```

### Security Rules Rollback
Checkout the previous stable git commit and deploy rules:
```bash
git checkout <PREVIOUS_COMMIT> -- firestore.rules storage.rules
firebase deploy --only firestore:rules,storage:rules
```

### Payment Data Protection Invariant
> ⚠️ **NEVER solve a rollback by deleting orders, checkout sessions, or payment transactions.**
> Payment records are financial ledgers. Reconciliation anomalies must be resolved via the `/api/admin/orders/[id]/refund` administrative workflow.

---

## 6. Observability & Operations Playbook

### 1. Cloud Run 5xx Spike
- Check Google Cloud Logging for `service: "osvid-web"` and `severity: "ERROR"`.
- Verify database connectivity: Is Cloud Run service account permissioned for Firestore?
- Check container memory and instance concurrency limits in Cloud Run console.

### 2. Paystack Webhook Delivery Failures
- Inspect Paystack Webhook logs in Paystack Dashboard for HTTP response codes.
- HTTP 401: Paystack secret key mismatch or modified webhook payload in transit.
- HTTP 500: Database lock or payment finalizer error. Check logs for correlation `paystackReference`. Paystack will automatically retry exponentially.

### 3. Payment Reconciliation Anomaly (`anomaly_unfulfillable`)
- Cause: Payment succeeded on Paystack, but cart stock or coupon became invalid before finalization.
- System automatically attempts automated refund claim.
- If refund outcome is ambiguous, status is marked `needs_attention`.
- **Action**: Staff opens Admin Dashboard -> Orders -> Filter by `needs_attention`, verifies Paystack dashboard, and triggers administrative refund completion.

### 4. Stale Checkout Reservations
- Verify Cloud Scheduler job `osvid-cleanup-expired-reservations` is active and healthy.
- Check Cloud Scheduler execution history for HTTP 200 responses.
- If scheduler failed with 401, verify `MAINTENANCE_CRON_SECRET` matches Cloud Run secret configuration.

### 5. Media Upload Failures
- Client-side error "Unsupported image format": User selected file outside JPEG, PNG, WebP.
- Client-side error "File size exceeds 5 MB": Image exceeds maximum allowed limit.
- Storage 403 Forbidden: Staff member permissions lack `canManageProducts` or business subscription document is marked `isSuspended: true`.
