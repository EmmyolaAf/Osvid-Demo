# OSVID CHEMICALS LTD. — Web Application

![Next.js 16](https://img.shields.io/badge/Next.js-16.2.2-black)
![React 19](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%7C%20Storage-FFA611)
![Google Cloud](https://img.shields.io/badge/Runtime-Cloud%20Run-4285F4)
![Paystack](https://img.shields.io/badge/Payments-Paystack-0BA4DB)

Production web application and e-commerce platform for **OSVID CHEMICALS LTD.**, built with Next.js 16 standalone server runtime on Google Cloud Run with Firebase Hosting as the public front door.

---

## 1. Architecture Overview

```
                      Internet / Customers
                               │
                               ▼
                   Firebase Hosting (osvid)
                   [Public CDN & Static Assets]
                               │
                   Rewrite: /api/** & routes
                               │
                               ▼
                     Google Cloud Run
                     [Service: osvid-web]
                 Next.js 16 Standalone Server
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     Google Cloud       Paystack Payments   Resend Email
    Firestore & Storage (Webhooks & API)   (Transactional)
    (ADC Service Acct)
```

### Key Architectural Invariants:
1. **Dynamic Runtime**: Server-authoritative checkout, inventory reservation, payment verification, and webhook processing run on Next.js 16 within Google Cloud Run (`output: "standalone"`).
2. **Public Front Door**: Firebase Hosting provides SSL termination, edge caching for static assets (`/_next/static/**`), and anti-cache headers for `/api/**`.
3. **Application Default Credentials (ADC)**: Cloud Run production uses Google Application Default Credentials via the runtime service account. No long-lived service account JSON keys are committed, baked into Docker images, or loaded in production.
4. **Server-Authoritative Commerce**: Pricing, discounts, inventory deductions, and order creation are computed exclusively on the server. Direct client order creation in Firestore is blocked by security rules.

---

## 2. Technology Stack

- **Framework**: Next.js 16.2.2 (App Router, Standalone Server Output)
- **UI Library**: React 19, Tailwind CSS v4, Radix UI primitives, Lucide icons
- **Database & Storage**: Google Cloud Firestore & Firebase Storage
- **Server Identity**: Firebase Admin SDK with Google ADC
- **Payment Processing**: Paystack API (Inline Popup V2, Webhooks, HMAC SHA-512 verification)
- **Transactional Email**: Resend API
- **Containerization**: Multi-stage Docker (`node:20-alpine`)

---

## 3. Role-Based Access Control (RBAC)

The application enforces strict multi-tier authorization via Firestore Security Rules and server middleware:

| Role | Scope | Permissions |
| :--- | :--- | :--- |
| **Super Admin** | Platform Owner (`abolarinwaemmanuelfree@gmail.com`) | Full authority, subscription lifecycle governance, emergency break-glass recovery. Immutable. |
| **Admin** | Business Operations Manager | Staff profile management, catalogue administration, order fulfillment. Cannot delete Super Admin or modify subscription state. |
| **Manager** | Operational Staff | Granular capabilities based on assigned permissions: `canManageProducts`, `canManageInventory`, `canManageOrders`, `canManageWebsite`. |
| **Customer** | Authenticated User / Guest | Reads active catalogue, initiates server checkout sessions, views own orders. Direct writes to orders, transactions, and inventory are blocked. |

---

## 4. Environment Configuration

Copy `.env.example` to `.env.local` for local development.

> ⚠️ **CRITICAL SECURITY WARNING**:
> - NEVER commit `.env`, `.env.local`, or `firebase-service-account.json` to source control.
> - NEVER prefix server secrets with `NEXT_PUBLIC_`.
> - Production secrets must be managed exclusively through Google Secret Manager or Cloud Run environment variables.

### Environment Variable Contract

| Variable | Classification | Description |
| :--- | :--- | :--- |
| `PAYSTACK_SECRET_KEY` | **SERVER SECRET** | Paystack secret API key (`sk_live_...` or `sk_test_...`) |
| `RESEND_API_KEY` | **SERVER SECRET** | Resend email API key (`re_...`) |
| `MAINTENANCE_CRON_SECRET` | **SERVER SECRET** | High-entropy token for authenticating internal maintenance endpoints |
| `FIREBASE_PROJECT_ID` | **SERVER NON-SECRET** | GCP Project ID (`osvid-9d4d6`) |
| `FROM_EMAIL` | **SERVER NON-SECRET** | Verified sender email for order emails (`orders@osvid.com.ng`) |
| `BCC_EMAIL` | **SERVER NON-SECRET** | Internal notification BCC address |
| `PORT` | **SERVER NON-SECRET** | Server listening port (default `8080`) |
| `NODE_ENV` | **SERVER NON-SECRET** | `production`, `development`, or `test` |
| `NEXT_PUBLIC_BASE_URL` | **PUBLIC CONFIG** | Canonical storefront base URL |
| `NEXT_PUBLIC_FIREBASE_*` | **PUBLIC CONFIG** | Firebase Web SDK configuration credentials |

---

## 5. Local Development & Testing

### Installation
```bash
npm install
```

### Running Locally
```bash
npm run dev
```

### Type Checking & Linting
```bash
npm run typecheck
npm run lint
```

### Unit & Integration Tests (Mocked Providers)
```bash
npm test
```

### Real Firebase Emulator Security Tests
Requires Java 21+ and Firebase CLI:
```bash
npm run test:emulator
```

### Production Build
Generates dynamic standalone Next.js server bundle:
```bash
npm run build
```

---

## 6. Container & Production Deployment

For detailed staging acceptance criteria and release procedures:
- [Deployment Runbook & Operations Guide](docs/DEPLOYMENT.md)
- [Staging Acceptance & Paystack Checklist](docs/STAGING_ACCEPTANCE.md)

### Building the Docker Container Locally
```bash
docker build -t osvid-web:latest .
```

### Running the Container Locally
```bash
docker run -p 8080:8080 \
  -e NODE_ENV=production \
  -e PAYSTACK_SECRET_KEY=sk_test_... \
  -e RESEND_API_KEY=re_... \
  -e FIREBASE_PROJECT_ID=osvid-9d4d6 \
  osvid-web:latest
```
