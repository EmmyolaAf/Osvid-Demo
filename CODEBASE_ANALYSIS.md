# PROJECT DIAGNOSTIC & MIGRATION AUDIT REPORT

**Target Platform:** Google Firebase Architecture (Firestore, Firebase Auth, Cloud Storage, Firebase Hosting / Cloud Functions / Next.js Serverless)  
**Legacy Systems:** Wix Headless SDKs (`@wix/sdk`, `@wix/stores`, `@wix/ecom`, `@wix/members`, `@wix/data`, `@wix/redirects`), EmailJS, Paystack  
**Audit Conducted By:** Principal Software Architect  
**Date:** September 2026  

---

## 1. Executive Summary & Tech Stack Overview

### 1.1 Project Structure & Tech Stack
* **Framework:** Next.js `16.2.2` (Next.js App Router with Turbopack).
* **Language & Runtime:** TypeScript `5.x`, Node.js `20+` / `24.x`.
* **Styling & UI Components:** 
  * Tailwind CSS `v4` with `@tailwindcss/postcss` and `@tailwindcss/typography`.
  * Radix UI primitives (`@radix-ui/react-accordion`, `@radix-ui/react-dialog`, `@radix-ui/react-label`, `@radix-ui/react-radio-group`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slot`).
  * Class variance utilities: `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`.
  * Animation & Visuals: `framer-motion 12.x`, `keen-slider`, `embla-carousel-react`, `swiper`, `react-fast-marquee`, `react-medium-image-zoom`.
  * Icons: `lucide-react`, `react-icons`.
* **Routing Architecture:** Next.js App Router with Route Groups:
  * `(live)`: Public customer storefront, catalog, product details, services, portfolio, blog, cart, multi-step checkout, and user order tracking.
  * `(auth)`: Login, registration, forgot-password pages.
  * `dashboard`: Role-Based Access Control (RBAC) Admin Suite for Super Admin, Admin, and Operations Managers (Products, Orders, Customers, Discounts, Website Content Editor, Financials).
  * `maintenance`: Maintenance lockdown page with real-time API toggle.
  * `api`: Serverless API routes for Paystack payment verification, admin staff management, checkout intent, email dispatch, and maintenance status.
* **State Management & Data Fetching:**
  * Server-side caching: React `cache()`, Next.js Server Components.
  * Client-side state: React Context API (`AuthContext`, `CartProvider`, `CheckoutProvider`, `CheckoutContext`, `WixContext`).
  * Server-state synchronization: `@tanstack/react-query 5.x` with `@tanstack/react-query-devtools`, and `swr 2.3.x`.
  * Local persistence: `localStorage` and `sessionStorage` fallback layers.
* **Form Handling & Validation:** `react-hook-form`, `zod 3.24.x`, `@hookform/resolvers`.
* **Notifications & Feedback:** `sonner` toasts, custom loaders, and preloader animations.

### 1.2 Current State of the Codebase
* **Storefront UI:** Highly complete, responsive, and aesthetically polished with rich animations, branded color palettes (OSVID industrial theme), dynamic carousels, and comprehensive product/service presentation.
* **Commerce & Checkout:** The front-end possesses two checkout pathways:
  1. A legacy Wix redirect checkout (`wix-api/checkout.ts`).
  2. A modern, custom 4-step Nigerian commerce checkout (`/checkout`) supporting shipping addresses, pickup locations, inline Paystack NGN transactions, and automated Resend email receipt generation.
* **Admin Dashboard:** Fully designed and integrated with Firebase Firestore and Firebase Auth (`/dashboard` with views for analytics, products, orders, customers, discount codes, team managers, and a visual website CMS editor).
* **Migration Status:** The codebase is in a transitional "hybrid" state. The admin portal and customer order history already communicate with Firebase Firestore (`lib/firebase/firestore.ts`), while the public product catalog, services, blog, and legacy cart hooks (`wix-api/*`) still rely on Wix Headless APIs or static mock fallback data. Complete decommissioning of Wix is feasible with minimal structural refactoring.

---

## 2. Directory & Architecture Mapping

### 2.1 Workspace Directory Tree
```
osvidcompany-web-app/
├── app/
│   ├── (auth)/
│   │   ├── forgot-password/page.tsx
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (live)/
│   │   ├── about/page.tsx
│   │   ├── account/
│   │   │   ├── orders/page.tsx
│   │   │   └── page.tsx
│   │   ├── blog/
│   │   │   ├── [slug]/page.tsx
│   │   │   └── page.tsx
│   │   ├── cart/page.tsx
│   │   ├── checkout/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── portfolio/page.tsx
│   │   ├── products/
│   │   │   ├── [categorySlug]/page.tsx
│   │   │   └── page.tsx
│   │   ├── services/
│   │   │   ├── [slug]/page.tsx
│   │   │   └── page.tsx
│   │   └── shop/
│   │       ├── [slug]/
│   │       │   ├── client.tsx
│   │       │   ├── page.tsx
│   │       │   ├── ProductMedia.tsx
│   │       │   ├── ProductOptions.tsx
│   │       │   └── ProductPrice.tsx
│   │       ├── ShopClientPage.tsx
│   │       └── page.tsx
│   ├── api/
│   │   ├── admin/
│   │   │   ├── create/route.ts
│   │   │   ├── delete/route.ts
│   │   │   └── toggle-status/route.ts
│   │   ├── auth/callback/wix/route.ts
│   │   ├── checkout/create-payment-intent/route.ts
│   │   ├── email/route.ts
│   │   ├── maintenance/route.ts
│   │   ├── payment/verify/route.ts
│   │   └── route.ts
│   ├── dashboard/
│   │   ├── customers/page.tsx
│   │   ├── discounts/page.tsx
│   │   ├── financials/page.tsx
│   │   ├── layout.tsx
│   │   ├── managers/page.tsx
│   │   ├── orders/page.tsx
│   │   ├── page.tsx
│   │   ├── products/page.tsx
│   │   ├── super-admin/page.tsx
│   │   └── website-editor/page.tsx
│   ├── maintenance/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   ├── ReactQueryProvider.tsx
│   ├── template.tsx
│   └── transition.tsx
├── assets/
├── components/
│   ├── auth/
│   │   ├── ProtectedRoute.tsx
│   │   └── SuspensionBarrier.tsx
│   ├── editor/
│   ├── reusables/
│   │   ├── cards/
│   │   │   ├── BlogCard.tsx
│   │   │   ├── FeaturedServiceCard.tsx
│   │   │   ├── MisionVisionCard.tsx
│   │   │   ├── PortfolioCard.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductCategoryCard.tsx
│   │   │   ├── ServiceCard.tsx
│   │   │   ├── ServiceCategoryCard.tsx
│   │   │   ├── TeamMemberCard.tsx
│   │   │   └── TestimonialCard.tsx
│   │   ├── cart/
│   │   │   ├── CartDrawer.tsx
│   │   │   ├── CartItem.tsx
│   │   │   ├── CartItemImage.tsx
│   │   │   ├── CartPage.tsx
│   │   │   ├── CartTrigger.tsx
│   │   │   └── ProductImage.tsx
│   │   ├── checkout/
│   │   │   ├── AddressAutocomplete.tsx
│   │   │   ├── CheckoutErrorBoundary.tsx
│   │   │   ├── CheckoutHeader.tsx
│   │   │   ├── CheckoutProgress.tsx
│   │   │   ├── ConfirmationStep.tsx
│   │   │   ├── DeliveryMethodStep.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   ├── OrderItemsList.tsx
│   │   │   ├── OrderSummaryStep.tsx
│   │   │   ├── PickupLocationStep.tsx
│   │   │   └── ShippingAddressStep.tsx
│   │   ├── forms/
│   │   │   └── ContactForm.tsx
│   │   ├── sections/
│   │   │   ├── about/
│   │   │   ├── BlogSection.client.tsx
│   │   │   ├── BlogSection.server.tsx
│   │   │   ├── cta.tsx
│   │   │   ├── featured-products.tsx
│   │   │   ├── featured-services.tsx
│   │   │   ├── foundation-section.tsx
│   │   │   ├── hero-section.tsx
│   │   │   ├── NewsletterForm.tsx
│   │   │   ├── services-section.tsx
│   │   │   ├── TestimonialsSection.tsx
│   │   │   ├── TrustBuildingSection.tsx
│   │   │   ├── TrustHeroSection.tsx
│   │   │   └── why-choose-us.tsx
│   │   ├── skeletons/
│   │   ├── BackInStockNotificationButton.tsx
│   │   ├── BuyNowButton.tsx
│   │   ├── CompactBulkOrder.tsx
│   │   ├── DiscountBadge.tsx
│   │   ├── G4Analytics.tsx
│   │   ├── InstantPreloader.tsx
│   │   ├── LoadingButton.tsx
│   │   ├── PageHeader.tsx
│   │   ├── Preloader.tsx
│   │   ├── ShoppingCartButton.tsx
│   │   ├── TestimonialCarousels.tsx
│   │   ├── TileRevealImage.tsx
│   │   ├── WhatsappButton.tsx
│   │   └── WixImage.tsx
│   ├── shared/
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   └── ScrollToTop.tsx
│   └── ui/ (Button, Dialog, Input, Card, Sheet, Dropdown, Table, Badge, Form, etc.)
├── contexts/
│   ├── AuthContext.tsx
│   ├── checkoutContext.tsx
│   └── wixContext.tsx
├── data/
│   ├── company.ts
│   ├── products.ts
│   ├── services.ts
│   └── testimonials.ts
├── helpers/
│   └── formatCurrency.ts
├── hooks/
│   ├── back-in-stock.ts
│   ├── cart.ts
│   ├── checkout.ts
│   ├── useTeam.ts
│   ├── useWindowSize.ts
│   └── useWixClient.tsx
├── lib/
│   ├── firebase/
│   │   ├── admin.ts
│   │   ├── client.ts
│   │   ├── content.ts
│   │   ├── firestore.ts
│   │   └── subscription.ts
│   ├── checkout.ts
│   ├── constants.ts
│   ├── email.ts
│   ├── email-templates.ts
│   ├── fetchers.ts
│   ├── firebase.ts
│   ├── payment.ts
│   ├── utils.ts
│   ├── validation.ts
│   ├── wix-client.base.ts
│   ├── wix-client.browser.ts
│   └── wix-client.server.ts
├── providers/
│   ├── CartProvider.tsx
│   └── CheckoutProvider.tsx
├── public/
│   ├── images/
│   └── icons/
├── types/
│   ├── auth.ts
│   ├── checkout.type.ts
│   ├── content.ts
│   ├── index.d.ts
│   ├── order-types.ts
│   └── wixContentTypes.ts
├── utils/
│   └── wixImageUtils.ts
├── wix-api/
│   ├── backInStockNotifications.ts
│   ├── blog.ts
│   ├── cart.ts
│   ├── checkout.ts
│   ├── collections.ts
│   ├── companyData.ts
│   ├── hero.ts
│   ├── products.ts
│   ├── services.ts
│   ├── teams.ts
│   └── testimonials.ts
├── env.ts
├── firebase.json
├── firebase-service-account.json
├── middleware.ts
├── next.config.ts
└── package.json
```

### 2.2 Major UI Routes & Pages Inventory

| Route | Purpose / Description | Primary Data Source |
| :--- | :--- | :--- |
| `/` | Homepage (Hero, Stats, Featured Products, Services, Why Us, Testimonials, Blog CTA) | `wix-api/hero.ts`, `services.ts`, `testimonials.ts`, `lib/firebase/content.ts` |
| `/shop` | Full chemical & material product catalog with pagination, search, sorting | `wix-api/products.ts` (Target: Firestore `products`) |
| `/shop/[slug]` | Product details, image gallery, unit selectors, quantity controls, bulk discount info | `wix-api/products.ts` (Target: Firestore `products`) |
| `/products` | Category landing page (Surface care, epoxy, adhesives, sealants) | `wix-api/products.ts` / `getProductscategories` |
| `/products/[categorySlug]` | Products filtered by specific industry category | `wix-api/products.ts` |
| `/services` | Industrial & technical chemical application services catalog | `wix-api/services.ts` & `@/data/services.ts` |
| `/services/[slug]` | Detailed service breakdown and consultation triggers | `wix-api/services.ts` |
| `/portfolio` | Chemical application gallery and past project case studies | Static dataset / `@/data` |
| `/blog` | Technical articles, safety protocols, chemical guides | `wix-api/blog.ts` |
| `/blog/[slug]` | Full blog post with rich text and author metadata | `wix-api/blog.ts` |
| `/about` | Company background, mission, core values, leadership team | `wix-api/teams.ts` & `lib/firebase/content.ts` |
| `/contact` | Contact details, office map, technical consultation request form | EmailJS Form (`ContactForm.tsx`) |
| `/cart` | Standalone shopping cart management page | `CartProvider` (`sessionStorage`) |
| `/checkout` | 4-step checkout flow (Delivery, Shipping/Pickup, Summary/Paystack, Confirmation) | `CheckoutProvider` + Paystack inline + `/api/payment/verify` |
| `/account` | Customer profile management and overview | Firebase Auth + Firestore `users` collection |
| `/account/orders` | Customer order history with live delivery status stepper | Firestore `orders` (queried by `userId`) |
| `/login` | Customer / Staff login with Email/Password & Google Provider | Firebase Auth |
| `/register` | Customer registration with profile initialization | Firebase Auth + Firestore `users` doc |
| `/forgot-password` | Password recovery via email link | Firebase Auth `sendPasswordResetEmail` |
| `/dashboard` | Executive KPI Overview (Revenue, order volumes, inventory alerts) | Firestore (`orders`, `products`, `users`) |
| `/dashboard/products` | Complete Product Catalog & Inventory Manager (Create, Edit, Delete, Stock) | Firestore `products` collection |
| `/dashboard/orders` | Orders management, status updates, tracking numbers, customer inspect | Firestore `orders` collection |
| `/dashboard/customers` | Customer Directory, purchase totals, spending metrics, status | Firestore `users` + `orders` aggregations |
| `/dashboard/discounts` | Coupon / Discount code engine (fixed or % off, expiry, limits) | Firestore `discounts` collection |
| `/dashboard/managers` | Staff & Manager RBAC management, granular permission assignment | Firestore `users` (Admin/Manager roles) |
| `/dashboard/website-editor` | Live Storefront CMS (Hero, Announcement banner, About, Contact) | Firestore `site_content` collection |
| `/dashboard/financials` | In-depth revenue breakdowns, paid vs pending transactions | Firestore `orders` collection |
| `/dashboard/super-admin` | Platform health, multi-admin governance, global system controls | Firestore analytics |
| `/maintenance` | Storefront maintenance screen with access bypass logic | Next.js API `/api/maintenance` |

---

## 3. Product Catalog & Commerce Workflow Analysis

### 3.1 Product Listing & Fetching Architecture
* **Current Implementation:**
  * Public shop (`/shop`) queries Wix Headless via `wixClient.products.queryProducts()` with server-side pagination (`PRODUCTS_PER_PAGE = 12`), sorting (`price`, `price-desc`, `name-asc`, `name-desc`, `lastUpdated`), and name filtering.
  * Individual category pages (`/products/[categorySlug]`) fetch collection items from Wix Data collections (`products_categories`).
  * Product details (`/shop/[slug]`) retrieves data via `getProductBySlug(slug)` and recommendations via `wixClient.recommendations.getRecommendation()`.
* **State of Data Models:**
  * The frontend maintains dual interfaces: Wix `products.Product` and custom clean `Product` (`types/auth.ts` and `types/index.d.ts`).
  * Fields include: `id`, `name`, `slug`, `description`, `price`, `discountPrice`, `stockQuantity`, `category`, `imageUrl`, `galleryImages`, `unit` (e.g., kg, L, drums), `sku`, `isFeatured`, and `isActive`.

### 3.2 Cart & Order State Management
The project contains two cart paradigms:
1. **Legacy Wix Cart Hook (`hooks/cart.ts`):**
   * Uses React Query mutations and queries communicating with `@wix/ecom` `currentCart`.
   * Requires Wix visitor session cookies created in `middleware.ts`.
2. **Standardized Client-Side Cart (`providers/CartProvider.tsx`):**
   * Uses React Context with `sessionStorage` synchronization key `"cart"`.
   * Provides `addToCart()`, `removeFromCart()`, `updateQuantity()`, `clearCart()`, `totalItems`, and `subtotal`.
   * Operates completely decoupled from any external backend, allowing direct transfer to Firebase Firestore at checkout.

### 3.3 Checkout & Payment Architecture
* **Step 1: Delivery Method Selection (`DeliveryMethodStep.tsx`):**
  * Option between `shipping` (Home/Site Delivery) and `pickup` (Warehouse/Office collection).
  * Collects `name`, `email`, and Nigerian `phone` (validated with Zod regex `/^(\+234|0)[789]\d{9}$/`).
* **Step 2: Shipping / Pickup Address (`ShippingAddressStep.tsx` / `PickupLocationStep.tsx`):**
  * Shipping validates `streetAddress`, `city`, `state` (from list of 36 Nigerian states + FCT in `lib/constants.ts`), `country: "Nigeria"`, and optional `postalCode`.
  * Pickup selects from predefined pickup hubs (`DEMO_PICKUP_LOCATIONS`).
* **Step 3: Order Summary & Paystack Inline Gateway (`OrderSummaryStep.tsx`):**
  * Computes subtotal, dynamic shipping fees, and grand total.
  * Dynamically injects Paystack inline JavaScript SDK (`https://js.paystack.co/v1/inline.js`).
  * Initializes Paystack popup configured with `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, customer email, and total converted to Kobo.
  * Upon successful transaction, calls `/api/payment/verify` to verify the reference server-side with Paystack Secret Key and trigger automated HTML email confirmations via Resend.
* **Step 4: Confirmation & Receipt (`ConfirmationStep.tsx`):**
  * Displays order reference, delivery details, and customer support direct WhatsApp link.

### 3.4 Form Submissions & Validations Inventory

| Form Component | Location | Fields & Inputs | Validation Library / Logic | Target Destination |
| :--- | :--- | :--- | :--- | :--- |
| **Contact / Inquiry Form** | `components/reusables/forms/ContactForm.tsx` | `name`, `email`, `message` | Native regex & length validation | EmailJS (`@emailjs/browser`) |
| **Newsletter Form** | `components/reusables/sections/NewsletterForm.tsx` | `email` | HTML5 validation + React state | Staged for API / Firestore |
| **Back in Stock Request** | `components/reusables/BackInStockNotificationButton.tsx` | `email` | Zod + React Hook Form | Wix Back-in-Stock / Target: Firestore `back_in_stock_requests` |
| **Checkout Delivery & Contact** | `components/reusables/checkout/DeliveryMethodStep.tsx` | `deliveryMethod`, `name`, `email`, `phone` | Zod (`deliveryMethodSchema`) | `CheckoutProvider` (`sessionStorage`) |
| **Checkout Shipping Address** | `components/reusables/checkout/ShippingAddressStep.tsx` | `streetAddress`, `city`, `state`, `postalCode` | Zod (`shippingAddressSchema`) | `CheckoutProvider` (`sessionStorage`) |
| **Admin Product Modal** | `app/dashboard/products/page.tsx` | `name`, `category`, `price`, `discountPrice`, `stockQuantity`, `unit`, `description`, `imageUrl` | Controlled React State + Toast validation | Firestore `products` collection |
| **Admin Discount Creator** | `app/dashboard/discounts/page.tsx` | `code`, `description`, `discountType`, `discountValue`, `minOrderAmount`, `maxUsageLimit`, `expiryDate` | Controlled React State | Firestore `discounts` collection |
| **Staff / Manager Creator** | `app/dashboard/managers/page.tsx` | `displayName`, `email`, `password`, `customTitle`, `phoneNumber`, `permissions` (6 booleans) | Controlled React State + Firebase Auth API | Firebase Auth (`/api/admin/create`) + Firestore `users` |
| **Storefront CMS Editor** | `app/dashboard/website-editor/page.tsx` | Hero headings, badges, CTA links, announcements, about summary, contact phones | Controlled React State + Realtime Broadcast | Firestore `site_content/homepage` |

---

## 4. Backend Dependencies & External API Surface (Wix / Legacy Integrations)

### 4.1 Direct Wix Dependencies & References
The audit identified all imports and integrations relying on the Wix ecosystem:

1. **NPM Packages (`package.json`):**
   * `@wix/data: ^1.0.225`
   * `@wix/ecom: ^1.0.1095`
   * `@wix/media: ^1.0.159`
   * `@wix/members: ^1.0.238`
   * `@wix/redirects: ^1.0.77`
   * `@wix/reviews: ^1.0.68`
   * `@wix/ricos: 1.0.0`
   * `@wix/sdk: ^1.15.16`
   * `@wix/site-ecom: ^1.10.0`
   * `@wix/stores: ^1.0.409`
   * `ricos-content: ^10.102.0`
   * `ricos-schema: ^10.102.0`

2. **Configuration & Environment Variables (`env.ts`, `.env.local`):**
   * `WIX_API_KEY`
   * `NEXT_PUBLIC_WIX_CLIENT_ID`
   * `NEXT_PUBLIC_WIX_SITE_ID`

3. **Core Wix SDK Client Wrappers:**
   * `lib/wix-client.base.ts`: Base client builder configuring OAuth, stores, ecom, members, redirects.
   * `lib/wix-client.browser.ts`: Browser singleton using OAuth strategy and cookies.
   * `lib/wix-client.server.ts`: Server-side cached client using Next.js cookies and `getWixPublicDataClient()`.
   * `contexts/wixContext.tsx` & `hooks/useWixClient.tsx`: Context provider injecting `WixClient`.

4. **API Service Modules (`/wix-api`):**
   * `wix-api/products.ts`: Querying products, collections, categories, related items.
   * `wix-api/cart.ts`: Adding, modifying, clearing cart line items on Wix ecom.
   * `wix-api/checkout.ts`: Creating Wix redirect sessions.
   * `wix-api/collections.ts`: Querying Wix product collections.
   * `wix-api/services.ts`: Querying Wix Data `"Services"` collection.
   * `wix-api/blog.ts`: Querying Wix Data `"blog"` collection.
   * `wix-api/testimonials.ts`: Querying Wix Data `"testimonials"` collection.
   * `wix-api/teams.ts`: Querying Wix Data `"teams"` collection.
   * `wix-api/hero.ts`: Querying Wix Data `"HeroData"` collection.
   * `wix-api/backInStockNotifications.ts`: Submitting back-in-stock alert requests to Wix.

5. **Utilities & Middlewares:**
   * `middleware.ts`: Generates visitor tokens using `@wix/sdk` OAuth strategy and sets `WIX_SESSION_COOKIE`.
   * `lib/parseWixImage.ts` & `utils/wixImageUtils.ts`: Parsing Wix media URIs (`wix:image://...`).
   * `components/reusables/WixImage.tsx`: Media component transforming Wix media tokens to static URLs.
   * `app/api/auth/callback/wix/route.ts`: OAuth callback handler for Wix members.

### 4.2 Identified Data Schemas

```typescript
// Product Entity
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPrice?: number;
  stockQuantity: number;
  category: string;
  imageUrl: string;
  galleryImages?: string[];
  unit?: string;           // "kg", "L", "drum", "bucket"
  sku?: string;
  isFeatured?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Order Entity
export interface Order {
  id: string;
  orderNumber: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryMethod: "pickup" | "delivery";
  shippingAddress: {
    fullName: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    postalCode?: string;
    notes?: string;
  };
  items: {
    id: string;
    productId: string;
    productName: string;
    price: number;
    quantity: number;
    imageUrl?: string;
    unit?: string;
  }[];
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  orderStatus: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  paystackReference?: string;
  trackingNumber?: string;
  notes?: string;
  statusHistory?: {
    status: OrderStatus;
    updatedAt: string;
    updatedBy?: string;
    note?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

// User & RBAC Profile
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  customTitle?: string;
  phoneNumber?: string;
  photoURL?: string;
  role: "super_admin" | "admin" | "manager" | "user";
  permissions?: {
    canManageProducts: boolean;
    canManageOrders: boolean;
    canViewFinancials: boolean;
    canManageWebsite: boolean;
    canManageCustomers: boolean;
    canManageDiscounts: boolean;
  };
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  lastLoginAt?: string;
}

// Discount Code Schema
export interface DiscountCode {
  id: string;
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount?: number;
  maxUsageLimit?: number;
  usageCount: number;
  isActive: boolean;
  expiryDate?: string;
  createdAt: string;
}

// Blog Post Schema
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  publishDate?: string | Date;
  author?: {
    name: string;
    avatar?: string;
  };
  category?: string;
  tags?: string[];
  comments?: number;
}

// Service Schema
export interface Service {
  _id: string;
  title: string;
  slug: string;
  description: string;
  image?: string;
  createdAt?: string;
  priority?: number;
}
```

---

## 5. Front-End State & Data Flow Audit

### 5.1 State Boundary Mapping

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GLOBAL APPLICATION STATE                        │
├──────────────────────┬──────────────────────┬──────────────────────────┤
│     AuthContext      │     CartProvider     │     CheckoutProvider     │
│   (Firebase Auth &   │ (SessionStorage Cart │ (Multi-step checkout data│
│   Firestore Profile) │  Items & Quantities) │  & validation state)     │
└──────────┬───────────┴──────────┬───────────┴────────────┬─────────────┘
           │                      │                        │
           ▼                      ▼                        ▼
┌──────────────────────┐┌─────────────────────┐┌─────────────────────────┐
│   Protected Routes   ││ Shopping Cart Drawer││  Order Summary / Payment│
│   & Dashboard Suite  ││ & Standalone Cart   ││  Paystack Inline Modal  │
└──────────────────────┘└─────────────────────┘└─────────────────────────┘
```

* **Shared Global State:**
  * `AuthContext`: Tracks active Firebase user, real-time snapshot of Firestore user profile document, role flags (`isSuperAdmin`, `isAdmin`, `isManager`, `isStaff`, `isCustomer`), and RBAC method dispatchers.
  * `CartProvider`: Manages the customer's active items, prices, quantities, subtotal calculations, drawer visibility (`isCartOpen`), and session synchronization.
  * `CheckoutProvider`: Retains step state (`currentStep`), contact details, chosen delivery mode, selected pickup hub, and validated shipping addresses across transitions.
* **Component-Local State:**
  * Search, filtering, and pagination in `/shop` and `/dashboard/*`.
  * Dialog/Modal toggles for adding products, managers, discount codes, or inspecting order breakdowns.
  * Interactive quantity steppers on single product pages (`/shop/[slug]/client.tsx`).
* **Server-Side Data Flow:**
  * Server Components (`app/(live)/page.tsx`, `app/(live)/shop/page.tsx`, `app/(live)/blog/page.tsx`) perform async data fetching during render with fallbacks provided by React `Suspense` and pre-built skeletons.

### 5.2 User Action Trigger Mapping

| Trigger Source | Action Performed | State / Network Impact |
| :--- | :--- | :--- |
| **"Add to Cart" Button** | Customer adds item from catalog or details | `CartProvider` updates state, serializes to `sessionStorage`, triggers Sonner success toast |
| **"Proceed to Checkout"** | Customer transitions from cart to `/checkout` | `CheckoutProvider` mounts step 1; loads cached contact details |
| **Paystack "Pay Now"** | Customer submits order summary | Paystack iframe opens; on completion, sends POST to `/api/payment/verify`, writes order to Firestore, empties cart, and sends Resend confirmation email |
| **"Save Product" Modal** | Admin adds/edits product in dashboard | Calls `saveProductToDb()`, updates/creates Firestore document in `products`, invalidates local list |
| **"Update Order Status"** | Manager selects new status in dropdown | Calls `updateOrderStatusInDb()`, appends entry to `statusHistory`, triggers instant UI badge update |
| **"Publish Storefront"** | Admin saves in Website Editor | Calls `saveSiteContent()`, updates Firestore `site_content/homepage`, emits `CustomEvent` for real-time live preview |
| **"Login / Register"** | User submits credentials / Google login | Firebase Auth authenticates, Firestore fetches profile, triggers route redirect |

---

## 6. Firebase Migration Readiness & Execution Plan

### 6.1 Required Firebase Services & Architecture Mapping

```
                             ┌────────────────────────────┐
                             │     Firebase Project:      │
                             │        osvid-9d4d6         │
                             └─────────────┬──────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│  Firebase Auth   │             │ Cloud Firestore  │             │  Cloud Storage   │
├──────────────────┤             ├──────────────────┤             ├──────────────────┤
│• Email / Password│             │• products        │             │• product-images/ │
│• Google Provider │             │• categories      │             │• blog-covers/    │
│• Custom Claims / │             │• orders          │             │• service-assets/ │
│  RBAC Roles      │             │• users           │             │• company-media/  │
│                  │             │• discounts       │             │• staff-avatars/  │
│                  │             │• site_content    │             │                  │
│                  │             │• blog_posts      │             │                  │
│                  │             │• services        │             │                  │
│                  │             │• testimonials    │             │                  │
│                  │             │• team_members    │             │                  │
│                  │             │• stock_alerts    │             │                  │
│                  │             │• contacts        │             │                  │
└──────────────────┘             └──────────────────┘             └──────────────────┘
```

### 6.2 Firestore Collections & Schema Migration Plan

1. **`products` Collection:**
   * Replaces Wix Stores catalog.
   * Documents indexed on `category`, `isActive`, `isFeatured`, `price`, `createdAt`.
2. **`product_categories` Collection:**
   * Replaces Wix Data `"products_categories"`.
   * Fields: `title`, `slug`, `description`, `imageUrl`, `priority`, `productCount`.
3. **`orders` Collection:**
   * Stores all direct customer orders and Paystack references.
   * Documents indexed on `userId`, `customerEmail`, `orderStatus`, `paymentStatus`, `createdAt`.
4. **`users` Collection:**
   * Houses user profiles, manager permission sets, spending totals, and RBAC roles (`super_admin`, `admin`, `manager`, `user`).
5. **`discounts` Collection:**
   * Houses promotional codes, discount types (`percentage` / `fixed`), minimum thresholds, and usage limits.
6. **`site_content` Collection:**
   * Document `homepage`: Stores dynamic hero banners, announcement bar toggles, about metrics, and contact details for the website editor.
7. **`services` Collection:**
   * Replaces Wix Data `"Services"`.
   * Fields: `title`, `slug`, `description`, `image`, `priority`, `createdAt`.
8. **`blog_posts` Collection:**
   * Replaces Wix Data `"blog"`.
   * Fields: `title`, `slug`, `excerpt`, `content`, `featuredImage`, `category`, `tags`, `publishDate`, `author`.
9. **`testimonials` Collection:**
   * Replaces Wix Data `"testimonials"`.
   * Fields: `name`, `role`, `content`, `imageUrl`, `rating`, `createdAt`.
10. **`team_members` Collection:**
    * Replaces Wix Data `"teams"`.
    * Fields: `name`, `role`, `imageUrl`, `bio`, `priority`.
11. **`back_in_stock_requests` Collection:**
    * Replaces Wix Back In Stock notifications.
    * Fields: `email`, `productId`, `productName`, `status: "pending" | "notified"`, `createdAt`.
12. **`contact_submissions` Collection:**
    * Stores customer inquiry submissions from `/contact` for lead management.

### 6.3 Complete CRUD Operations Audit

| Entity / Domain | Operation | Method / Action | Target Service & Endpoint | UX Feedback Required |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication** | Create | Sign up customer | Firebase Auth + `saveUserProfile()` | Toast: "Account created successfully" |
| **Authentication** | Read | Login / Session listener | Firebase Auth `onAuthStateChanged` | Seamless redirect + error toast on bad credentials |
| **Authentication** | Create (Staff) | Super Admin creates Manager | Next.js API `/api/admin/create` (Firebase Admin SDK) | Dialog loader + Toast: "Manager account created" |
| **Authentication** | Update | Update role / Toggle status | Firestore `users` doc update | Toast: "User permissions updated" |
| **Authentication** | Delete | Delete staff record | Next.js API `/api/admin/delete` | Confirmation dialog + Toast: "Account removed" |
| **Products** | Create | Admin adds new chemical | Firestore `products` (`saveProductToDb`) | Modal spinner + Toast: "Product published" |
| **Products** | Read (Store) | Fetch catalog / details | Firestore `getDocs(products)` query | Skeleton loader + Empty state if 0 items |
| **Products** | Update | Edit prices / Stock update | Firestore `updateDoc(products, id)` | Toast: "Stock updated successfully" |
| **Products** | Delete | Remove chemical listing | Firestore `deleteDoc(products, id)` | Confirm modal + Toast: "Product deleted" |
| **Orders** | Create | Submit completed order | Paystack Verify -> Firestore `orders` (`createOrderInDb`) | Full-page loader -> Confirmation Step + Email toast |
| **Orders** | Read (Customer)| View user order history | Firestore `getUserOrdersFromDb(userId)` | Stepper animation + Order card details |
| **Orders** | Read (Admin) | Filter & search all orders | Firestore `getOrdersFromDb(statusFilter)` | Table loader + Filter chip badges |
| **Orders** | Update | Change status / Add tracking| Firestore `updateOrderStatusInDb()` | Inline spinner + Toast: "Order marked as [status]" |
| **Discounts** | Create | Add coupon code | Firestore `saveDiscountInDb()` | Toast: "Discount code active" |
| **Discounts** | Read | Fetch active discounts | Firestore `getDiscountsFromDb()` | List render with copy-to-clipboard badges |
| **Discounts** | Delete | Deactivate coupon | Firestore `deleteDiscountFromDb()` | Toast: "Discount deleted" |
| **Storefront CMS**| Read | Fetch live homepage text | Firestore `getSiteContent()` + Local Cache | Instant SSR / Hydration with zero layout shift |
| **Storefront CMS**| Update | Publish new slogan/banner | Firestore `saveSiteContent()` | Toast: "Storefront content published live!" |
| **Blog & Content** | Read | Fetch articles / services | Firestore `getDocs(blog_posts / services)` | Modern grid cards + category pills |
| **Stock Alerts** | Create | Request notify on restock | Firestore `setDoc(back_in_stock_requests)` | Modal success confirmation |

### 6.4 Storage Migration Plan (Wix Media -> Firebase Cloud Storage)
* **Storage Bucket:** `osvid-9d4d6.firebasestorage.app`
* **Directory Layout:**
  * `/products/{productId}/main.webp` & `/products/{productId}/gallery/`
  * `/blog/{slug}/cover.webp`
  * `/services/{slug}/banner.webp`
  * `/avatars/{uid}/profile.webp`
* **Media Parser Transition:** Replace `WixImage.tsx` with standard Next.js `<Image />` leveraging Firebase Storage bucket domains configured in `next.config.ts`.

### 6.5 Middleware & Edge Runtime Optimization
* **Removal of Legacy Wix Middleware:** `middleware.ts` will no longer generate or refresh Wix OAuth tokens.
* **Simplified Next.js Middleware:** The new middleware will focus exclusively on:
  1. Maintenance mode checks (`MAINTENANCE_MODE` env / Firestore lock).
  2. Route protection for `/dashboard` and `/account` by inspecting Firebase session tokens.

### 6.6 Step-by-Step Migration Execution Roadmap

```
  PHASE 1: Data Models & Firebase Client Hardening
  ├── Standardize TypeScript schemas across catalog, orders, and content.
  ├── Verify Firebase Admin SDK service account key configuration.
  └── Configure Firebase Storage bucket and Next.js image domains.

  PHASE 2: Storefront Catalog Decommissioning from Wix
  ├── Implement Firestore queries in `lib/firebase/products.ts`, `services.ts`, `blog.ts`.
  ├── Update `/shop`, `/shop/[slug]`, and `/products` to pull directly from Firestore.
  └── Deprecate `wix-api/products.ts`, `wix-api/collections.ts`, and `wix-api/hero.ts`.

  PHASE 3: Cart & Checkout Decoupling
  ├── Deprecate `@wix/ecom` and remove `hooks/cart.ts` (Wix version).
  ├── Standardize all checkout routes on `providers/CartProvider.tsx`.
  └── Ensure `/api/payment/verify` writes completed orders directly to Firestore `orders`.

  PHASE 4: Back-in-Stock & Lead Form Integration
  ├── Route `BackInStockNotificationButton.tsx` to Firestore `back_in_stock_requests`.
  ├── Route `ContactForm.tsx` and `NewsletterForm.tsx` submissions to Firestore collections.
  └── Replace EmailJS with serverless Resend dispatch via Next.js API routes.

  PHASE 5: Wix SDK Teardown & Dependency Cleanup
  ├── Remove all `@wix/*` packages from `package.json`.
  ├── Remove `wix-api/` directory and `lib/wix-client.*.ts` files.
  ├── Strip Wix environment variables from `env.ts` and `.env.local`.
  └── Update `middleware.ts` to lightweight route guard logic.

  PHASE 6: Production Validation & Deployment
  ├── Seed initial Firestore collections with product, service, and testimonial records.
  ├── Execute end-to-end purchasing and Paystack test transactions.
  └── Conduct automated build verification (`next build`) and deploy.
```

---

## 7. Verification & Production Readiness Checklist

- [x] **Full Codebase Traversal Complete:** Inspected all components, hooks, contexts, API routes, types, and configurations.
- [x] **Wix Dependency Surface Mapped:** Documented all 11 Wix packages, 11 `wix-api` modules, client factories, and cookies.
- [x] **Commerce Architecture Validated:** Multi-step Nigerian checkout verified with inline Paystack and Resend transactional receipts.
- [x] **Firebase Foundation Verified:** Active Firebase client (`lib/firebase/client.ts`), Admin SDK (`lib/firebase/admin.ts`), and comprehensive Firestore repository (`lib/firebase/firestore.ts`).
- [x] **RBAC Matrix Documented:** Super Admin, Admin, Manager, and Customer roles with granular permissions mapped.
- [x] **Migration Action Plan Defined:** 6-phase roadmap with explicit collection schemas, CRUD matrix, and dependency teardown instructions.
