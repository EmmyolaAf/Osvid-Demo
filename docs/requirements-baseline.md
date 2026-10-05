# OSVID Technical Requirements Baseline & Authority Model

**Document Status:** Authoritative Repository Baseline  
**Target Installation:** OSVID Chemicals Limited (`osvid`)  
**Work Packet:** Packet 2 Reconciliation  
**Last Updated:** October 2026  

---

## 1. Executive Summary & Historical Context

Following the initial security foundation established in Packet 1, an original OSVID implementation specification was recovered and reconciled with subsequent intentional repository evolutions. 

This document serves as the repository's permanent, authoritative functional baseline. It defines:
1. The reconciled four-tier role hierarchy.
2. The separation between platform/provider governance and client business administration.
3. The granular operational permission matrix for delegated staff.
4. The client project isolation and subscription lifecycle model.
5. Tamper-resistant audit requirements and architectural guardrails.

---

## 2. Reconciled Role Hierarchy

```
+-------------------------------------------------------------+
|                        SUPER ADMIN                          |
|         (Service Provider / Platform Landlord)              |
+-------------------------------------------------------------+
                              |
+-------------------------------------------------------------+
|                           ADMIN                             |
|          (OSVID Client Highest Business Executive)          |
+-------------------------------------------------------------+
                              |
+-------------------------------------------------------------+
|                          MANAGER                            |
|       (Delegated OSVID Staff + Granular Permissions)        |
+-------------------------------------------------------------+
                              |
+-------------------------------------------------------------+
|                         CUSTOMER                            |
|                (Registered / Guest Shopper)                 |
+-------------------------------------------------------------+
```

### Hierarchy Definitions

1. **Super Admin (Provider Owner / Platform Landlord)**:
   - Represents the external software provider / hosting platform owner.
   - Holds exclusive authority over the client installation's subscription, annual licensing, kill-switch suspension, warning broadcast banner, provider audit logs, and OSVID Admin credential provisioning.
   - Does **not** represent an internal employee of OSVID Chemicals Limited.
   - Inherits full emergency operational authority over the client storefront and business records for support and maintenance.

2. **Admin (OSVID Business Administrator / Store Account)**:
   - Represents the highest authority within OSVID Chemicals Limited.
   - Holds complete operational control over OSVID's business data: catalogue, inventory, orders, customer directory, discounts, financial reports, and front-end website content.
   - Authorised to create, update, activate/deactivate, and delete operational Manager accounts.
   - Strictly prohibited from accessing or modifying provider-level system configuration, annual licensing, suspension settings, provider audit records, or creating/demoting other Administrators.

3. **Manager (Delegated Operational Staff)**:
   - Represents designated OSVID staff members assigned to specific operational duties (e.g., Inventory Lead, Product Specialist, Logistics Manager, Content Editor).
   - Base role is `role = "manager"` paired with an explicitly assigned, granular permission set and an optional human-readable `customTitle`.
   - Cannot create, modify, or delete other managers or administrators.
   - Cannot access provider-level settings or tamper with audit records.

4. **Customer / General User (`role = "user"`)**:
   - Represents public storefront visitors, registered retail buyers, and industrial accounts.
   - Authorized strictly to browse active catalogue products, place orders, view order history belonging to their account, and manage personal profile addresses.
   - Zero access to administrative or managerial endpoints.

---

## 3. Reconciled Permission Matrix

The table below reconciles the recovered original baseline with the repository's granular operational model:

| Functional Capability | Super Admin (Provider) | Admin (OSVID) | Manager (Original Baseline) | Manager (Reconciled Granular Model) | Customer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Browse Catalogue / Place Orders** | Yes | Yes | Yes | Yes | Yes |
| **Own Account & Orders** | Yes | Yes | Yes | Yes | Yes (Own only) |
| **Product Catalogue CRUD** (create/edit/delete/categories) | Yes | Yes | No | Required: `canManageProducts` | No |
| **Inventory & Stock Adjustments** (restock/corrections) | Yes | Yes | Yes | Required: `canManageInventory` | No |
| **Order Processing & Fulfillment** (shipping/tracking) | Yes | Yes | Yes | Required: `canManageOrders` | No |
| **Customer Directory & Inquiries** | Yes | Yes | No | Required: `canManageCustomers` | No |
| **Discount Codes & Promotions** | Yes | Yes | No | Required: `canManageDiscounts` | No |
| **CMS & Website Builder** | Yes | Yes | No | Required: `canManageWebsite` | No |
| **Financial Reports & Analytics** | Yes | Yes | Read-Only | Read-Only: `canViewFinancials` | No |
| **Manager CRUD & Delegation** | Yes | Yes | No | No | No |
| **Admin Provisioning & Deactivation** | Yes | No | No | No | No |
| **Annual Subscription & Killswitch** | Yes | No | No | No | No |
| **Provider Warning Broadcast** | Yes | No | No | No | No |
| **System Audit Logs (Tamper-Resistant)** | Read-Only | No | No | No | No |

---

## 4. Separation of Catalogue Authority vs Inventory Authority

In earlier implementations, product catalogue editing and stock levels were conflated under a single `canManageProducts` boolean. 

The reconciled architecture formally splits them:

1. **`canManageProducts` (Catalogue Authority)**:
   - Authority to create new product entries.
   - Edit title, descriptions, specifications, units, SKU, pricing, discount pricing, and gallery images.
   - Create, edit, and delete product categories.
   - Activate, deactivate, or delete products.

2. **`canManageInventory` (Inventory Authority)**:
   - Authority to adjust available on-hand stock quantities (`stockQuantity`).
   - Log restock shipments and stock corrections.
   - Review low-stock indicators and manage back-in-stock alerts.
   - Does **not** permit altering product descriptions, prices, categories, or deleting catalog entries.

### Backward-Compatibility Strategy
Existing Manager documents in production lack `canManageInventory`. To prevent breaking operational workflows:
- A normalizer (`normalizeManagerPermissions`) inspects manager permission documents.
- If `canManageInventory` is missing, it falls back to the value of `canManageProducts` (ensuring existing managers who previously managed stock retain their ability to do so).
- When new managers are created using the default baseline, `canManageProducts` defaults to `false` while `canManageInventory` defaults to `true`, reflecting the historical specification while encouraging explicit privilege assignment.

---

## 5. Provider / Super Admin Governance Model

The Super Admin is established as the **platform provider / landlord**, strictly segregated from client-level administrators:

1. **Provider Identity Verification**:
   - The primary provider email (`abolarinwaemmanuelfree@gmail.com`) acts as the bootstrap identity.
   - To prevent account takeover via unverified email sign-ups, Super Admin authority is gated behind multi-factor assurance: the account email must match AND must be verified (`email_verified == true` or `sign_in_provider == 'google.com'` or verified via `isProviderOwner` claim).
   - Unverified password accounts claiming the provider email address fail closed and receive standard user privileges.

2. **Provider Responsibilities**:
   - Setting annual hosting expiry dates and renewal fees (NGN).
   - Setting grace periods (default: 7 days).
   - Broadcasting administrative warning notices across the client dashboard.
   - Triggering the kill-switch suspension when licensing is past due.
   - Reviewing immutable audit logs of all staff and subscription mutations.

---

## 6. Client Project Isolation Architecture

To ensure the provider can scale to multiple client businesses in the future without premature multi-tenancy complexity:

- **Isolated Data Plane**: OSVID operates in its own dedicated Firebase project. Core business collections (`products`, `orders`, `users`, `discounts`, `services`, `blog_posts`) remain un-prefixed and isolated.
- **Client Identifier**: A lightweight typed configuration layer defines `clientId: "osvid"`.
- **Future Control Plane Ready**: A future centralized provider console can authenticate and interface with the OSVID project via dedicated server APIs without requiring OSVID to share database tables with other clients.

```
+------------------------------------------------------------+
|        FUTURE CENTRAL PROVIDER CONTROL PLANE               |
|      (Cross-Client Overview, Multi-Project Management)     |
+------------------------------------------------------------+
                              |
                     Secure Server APIs
                              |
+------------------------------------------------------------+
|             OSVID FIREBASE PROJECT (DATA PLANE)            |
|  - Client ID: osvid                                        |
|  - Isolated Collections: products, orders, users, etc.     |
|  - Local Provider Governance: system_settings, audit_logs  |
+------------------------------------------------------------+
```

---

## 7. Subscription Lifecycle & Suspension Semantics

The subscription state machine defines four deterministic states:

```
                  +--------------+
                  |    ACTIVE    |
                  +--------------+
                         |
      [Expiry <= 14 days OR showWarning = true]
                         |
                         v
                  +--------------+
                  |   WARNING    |
                  +--------------+
                         |
           [Past Expiry AND <= Grace Period]
                         |
                         v
                  +--------------+
                  |    GRACE     |
                  +--------------+
                         |
        [Past Grace Period OR Manual Killswitch]
                         |
                         v
                  +--------------+
                  |  SUSPENDED   |
                  +--------------+
```

1. **ACTIVE**: Normal operation. All storefront and management functions fully accessible.
2. **WARNING**: Normal operation continues. A warning notice is displayed on the client dashboard informing the client administrator of upcoming renewal.
3. **GRACE**: Normal storefront browsing continues. Prominent grace-period warning is displayed on the dashboard indicating that service shutdown is imminent unless payment is settled.
4. **SUSPENDED**: Business management operations are locked. 
   - Store administrators and managers encounter the `SuspensionBarrier` blocking dashboard access.
   - Customer historical order queries remain readable.
   - Business data is never mutated or destroyed.
   - Instant recoverability: Upon renewal or Super Admin reactivation, all features immediately resume normal active state.

---

## 8. Tamper-Resistant Audit Trail

To satisfy security compliance and provider governance:
- All administrative mutations are recorded in the `audit_logs` collection.
- Writes are restricted exclusively to trusted server-side Firebase Admin SDK routines. Client writes are completely denied in Firestore Security Rules (`allow write: if false;`).
- Read access to `audit_logs` is restricted to verified Super Admins.
- Events logged include:
  - Administrator creation, update, activation/deactivation, and deletion.
  - Manager creation, title/permission updates, status toggling, and deletion.
  - Subscription term modifications (expiry, fees, grace period).
  - Warning banner broadcasts and dismissals.
  - Kill-switch suspension and reactivation events.

---

## 9. Explicitly Deferred Capabilities

To maintain development velocity and strictly preserve project boundaries, the following features are intentionally deferred to subsequent work packets:
- **Inventory Movement Ledger**: Real-time batch-level inventory transaction logs, tracking restock receipts and order deducts (Packet 3).
- **Checkout & Payment Hardening**: Webhook idempotency, signature validation, and inventory allocation locking during checkout (Packet 4).
- **Multi-Tenant SaaS Control Plane**: Cross-project database aggregation or consolidated provider portal (Post-Hardening).
