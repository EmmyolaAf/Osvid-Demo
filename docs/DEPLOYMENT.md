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

## 3. Configuration Contract: Build-Time Client vs Runtime Server

### Critical Architectural Principle: Build-Time vs Runtime Boundary
Next.js inlines `NEXT_PUBLIC_*` environment variables directly into client-side JavaScript bundles during `next build` (inside the Docker builder stage).
Therefore, **Cloud Run runtime environment variables alone CANNOT change browser Firebase configuration after the image is built.**

- Staging and production container images **MUST** be built separately with the correct public Firebase configuration for each environment.
- Do NOT assume a single prebuilt container image can switch `NEXT_PUBLIC` Firebase projects at Cloud Run runtime.

---

### A. Client Build-Time Configuration (Non-Secret Docker Build Args)
These variables must be passed as `--build-arg` during `docker build`:

| Variable | Scope | Description / Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Build-time | Web API Key for target Firebase project |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Build-time | Auth domain (e.g. `<PROJECT_ID>.firebaseapp.com`) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Build-time | Target project ID (e.g. `osvid-9d4d6` or staging ID) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Build-time | Storage bucket (e.g. `<PROJECT_ID>.firebasestorage.app`) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Build-time | Firebase Cloud Messaging Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Build-time | Firebase Web App ID (`1:...:web:...`) |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Build-time (Optional) | Google Analytics 4 measurement ID (`G-...`) |
| `NEXT_PUBLIC_BASE_URL` | Build-time | Canonical public URL (e.g. `https://osvid.com.ng`) |

#### Example Docker Image Build (Placeholders Only — Do Not Commit Real Values)
```bash
docker build \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="<PUBLIC_FIREBASE_API_KEY>" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="<PROJECT_ID>.firebaseapp.com" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="<PROJECT_ID>" \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="<PROJECT_ID>.firebasestorage.app" \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="<MESSAGING_SENDER_ID>" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="<WEB_APP_ID>" \
  --build-arg NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="<OPTIONAL_MEASUREMENT_ID>" \
  --build-arg NEXT_PUBLIC_BASE_URL="https://<CANONICAL_DOMAIN>" \
  -t gcr.io/<PROJECT_ID>/osvid-web:<TAG> .
```

> ⚠️ **SECURITY WARNING**: NEVER supply `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `MAINTENANCE_CRON_SECRET`, or service account credentials as Docker build arguments. Those are strictly runtime secrets.

---

### B. Server Runtime Configuration (Cloud Run Environment & Secret Manager)
Configure these variables directly on Cloud Run (via Google Cloud Secret Manager for secrets):

| Variable | Scope / Type | Source / Value Description |
| :--- | :--- | :--- |
| `FIREBASE_PROJECT_ID` | Server Non-Secret | Target project ID (`osvid-9d4d6` or staging project ID) |
| `PAYSTACK_SECRET_KEY` | Server Secret | Paystack Live Secret Key `sk_live_...` |
| `RESEND_API_KEY` | Server Secret | Resend API key `re_...` |
| `MAINTENANCE_CRON_SECRET` | Server Secret | Cryptographically random 32+ character hex string |
| `NODE_ENV` | Server Non-Secret | `production` |
| `FROM_EMAIL` | Server Non-Secret | Verified sender mailbox (e.g. `orders@osvid.com.ng`) |
| `BCC_EMAIL` | Server Non-Secret | Operational order notification mailbox (`osvidbusinesses@gmail.com`) |

---

### C. Staging Environment & Split-Environment Prevention
- Staging browser Firebase configuration and server `FIREBASE_PROJECT_ID` **must** refer to the exact same Firebase project.
- > ⚠️ **MANUAL GATE — SEPARATE STAGING FIREBASE PROJECT**:
  > If a dedicated staging Firebase project has not yet been provisioned in Google Cloud Console, do **NOT** silently point staging browser builds to OSVID production Firebase (`osvid-9d4d6`).
  > Provision a distinct Firebase project (e.g. `osvid-staging`) before conducting full staging end-to-end testing.

---

## 4. Production Deployment Sequence

Follow this exact sequential order to prevent locking operational staff out due to fail-closed subscription security rules.

### Step 1: Provision Cloud Run Service & Secrets
1. Build the production container image using Docker build arguments matching the production Firebase project.
2. Create or update Cloud Run service `osvid-web` with the container image.
3. Attach runtime service account `osvid-web-runtime@osvid-9d4d6.iam.gserviceaccount.com`.
4. Configure runtime environment variables and Secret Manager references.

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
