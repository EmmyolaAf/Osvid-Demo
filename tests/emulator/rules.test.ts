import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";

const PROJECT_ID = "demo-osvid-rules-test";
const SUPER_ADMIN_EMAIL = "abolarinwaemmanuelfree@gmail.com";

let testEnv: RulesTestEnvironment;

function asPromise(task: any): Promise<any> {
  return new Promise((resolve, reject) => {
    task.then(resolve, reject);
  });
}

describe("Firebase Security Rules Real Emulator Suite", () => {
  before(async () => {
    const firestoreRules = fs.readFileSync(
      path.resolve(process.cwd(), "firestore.rules"),
      "utf8"
    );
    const storageRules = fs.readFileSync(
      path.resolve(process.cwd(), "storage.rules"),
      "utf8"
    );

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: firestoreRules,
      },
      storage: {
        rules: storageRules,
      },
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
      await testEnv.clearStorage();

      // Seed valid operational subscription by default
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc("runtime_settings/subscription").set({
          clientId: "osvid",
          isSuspended: false,
          hardSuspendAt: new Date(Date.now() + 86400000 * 30),
        });
      });
    }
  });

  // ==========================================================================
  // 1. FIRESTORE CUSTOMER BOUNDARY
  // ==========================================================================
  describe("Firestore Customer Boundary", () => {
    it("customer cannot create orders directly (Admin SDK only)", async () => {
      const customerCtx = testEnv.authenticatedContext("cust_123", {
        email: "cust@example.com",
      });
      const db = customerCtx.firestore();

      await assertFails(
        db.collection("orders").doc("ord_123").set({
          userId: "cust_123",
          total: 5000,
          status: "pending",
        })
      );
    });

    it("customer reads own UID order", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("orders").doc("ord_123").set({
          userId: "cust_123",
          customerEmail: "cust@example.com",
          total: 5000,
        });
      });

      const customerCtx = testEnv.authenticatedContext("cust_123", {
        email: "cust@example.com",
      });
      const db = customerCtx.firestore();

      await assertSucceeds(db.collection("orders").doc("ord_123").get());
    });

    it("unrelated customer cannot read order", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("orders").doc("ord_123").set({
          userId: "cust_123",
          customerEmail: "cust@example.com",
          total: 5000,
        });
      });

      const unrelatedCtx = testEnv.authenticatedContext("cust_456", {
        email: "other@example.com",
      });
      const db = unrelatedCtx.firestore();

      await assertFails(db.collection("orders").doc("ord_123").get());
    });

    it("unverified email fallback cannot claim guest order", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("orders").doc("ord_guest").set({
          userId: null,
          customerEmail: "guest@example.com",
          total: 5000,
        });
      });

      // Email unverified token
      const unverifiedCtx = testEnv.authenticatedContext("guest_user", {
        email: "guest@example.com",
        email_verified: false,
      });
      const db = unverifiedCtx.firestore();

      await assertFails(db.collection("orders").doc("ord_guest").get());
    });
  });

  // ==========================================================================
  // 2. FIRESTORE STAFF BOUNDARY
  // ==========================================================================
  describe("Firestore Staff Boundary", () => {
    beforeEach(async () => {
      // Seed staff profiles
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        // Product manager
        await db.collection("users").doc("mgr_product").set({
          role: "manager",
          isActive: true,
          permissions: { canManageProducts: true, canManageInventory: false },
        });
        // Inventory manager
        await db.collection("users").doc("mgr_inv").set({
          role: "manager",
          isActive: true,
          permissions: { canManageProducts: false, canManageInventory: true },
        });
        // Logistics manager
        await db.collection("users").doc("mgr_logistics").set({
          role: "manager",
          isActive: true,
          permissions: { canManageOrders: true },
        });
        // Unauthorized manager
        await db.collection("users").doc("mgr_unauth").set({
          role: "manager",
          isActive: true,
          permissions: {},
        });
        // Seed a sample product
        await db.collection("products").doc("prod_1").set({
          name: "Industrial Acid",
          stockQuantity: 100,
          price: 5000,
          isActive: true,
        });
      });
    });

    it("Product Manager has catalogue authority to edit product name", async () => {
      const pmCtx = testEnv.authenticatedContext("mgr_product");
      const db = pmCtx.firestore();

      await assertSucceeds(
        db.collection("products").doc("prod_1").update({
          name: "Industrial Acid 99%",
        })
      );
    });

    it("Product Manager cannot alter stockQuantity directly", async () => {
      const pmCtx = testEnv.authenticatedContext("mgr_product");
      const db = pmCtx.firestore();

      await assertFails(
        db.collection("products").doc("prod_1").update({
          stockQuantity: 200,
        })
      );
    });

    it("Inventory Manager cannot arbitrary-edit catalogue name", async () => {
      const invCtx = testEnv.authenticatedContext("mgr_inv");
      const db = invCtx.firestore();

      await assertFails(
        db.collection("products").doc("prod_1").update({
          name: "Tampered Name",
        })
      );
    });

    it("unauthorized Manager cannot read all orders", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("orders").doc("ord_test").set({
          userId: "cust_1",
          total: 1000,
        });
      });

      const unauthCtx = testEnv.authenticatedContext("mgr_unauth");
      const db = unauthCtx.firestore();

      await assertFails(db.collection("orders").doc("ord_test").get());
    });

    it("Logistics Manager with canManageOrders can read permitted orders", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("orders").doc("ord_test").set({
          userId: "cust_1",
          total: 1000,
        });
      });

      const logCtx = testEnv.authenticatedContext("mgr_logistics");
      const db = logCtx.firestore();

      await assertSucceeds(db.collection("orders").doc("ord_test").get());
    });

    it("direct order writes denied for staff (orders are Admin SDK server-authoritative)", async () => {
      const logCtx = testEnv.authenticatedContext("mgr_logistics");
      const db = logCtx.firestore();

      await assertFails(
        db.collection("orders").doc("ord_test").set({
          userId: "cust_1",
          status: "delivered",
        })
      );
    });
  });

  // ==========================================================================
  // 3. FIRESTORE RUNTIME & PROVIDER SETTINGS BOUNDARY (PACKET 5B)
  // ==========================================================================
  describe("Firestore Runtime & Provider Settings Boundary", () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.collection("users").doc("admin_staff").set({
          role: "admin",
          isActive: true,
        });
        await db.collection("users").doc("mgr_staff").set({
          role: "manager",
          isActive: true,
          permissions: { canManageProducts: true },
        });
        await db.collection("system_settings").doc("subscription").set({
          plan: "enterprise",
          privateSecret: "sec_123",
        });
        await db.collection("system_settings").doc("main_business").set({
          licenseKey: "lic_999",
        });
        await db.collection("system_settings").doc("general_info").set({
          companyName: "OSVID Chemicals",
        });
      });
    });

    it("runtime_settings/subscription is publicly readable by unauthenticated, customer, and staff", async () => {
      // 1. Unauthenticated caller
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(unauthDb.doc("runtime_settings/subscription").get());

      // 2. Authenticated customer
      const custDb = testEnv.authenticatedContext("cust_regular").firestore();
      await assertSucceeds(custDb.doc("runtime_settings/subscription").get());

      // 3. Admin & Manager staff
      const adminDb = testEnv.authenticatedContext("admin_staff").firestore();
      await assertSucceeds(adminDb.doc("runtime_settings/subscription").get());

      const mgrDb = testEnv.authenticatedContext("mgr_staff").firestore();
      await assertSucceeds(mgrDb.doc("runtime_settings/subscription").get());
    });

    it("runtime_settings/subscription direct client write is denied to ALL browser callers including Super Admin", async () => {
      // Customer cannot write
      const custDb = testEnv.authenticatedContext("cust_regular").firestore();
      await assertFails(
        custDb.doc("runtime_settings/subscription").set({ isSuspended: false })
      );

      // Manager cannot write
      const mgrDb = testEnv.authenticatedContext("mgr_staff").firestore();
      await assertFails(
        mgrDb.doc("runtime_settings/subscription").update({ isSuspended: false })
      );

      // Admin cannot write
      const adminDb = testEnv.authenticatedContext("admin_staff").firestore();
      await assertFails(
        adminDb.doc("runtime_settings/subscription").update({ isSuspended: false })
      );

      // Even verified Super Admin client SDK cannot write directly (server Admin API required)
      const saDb = testEnv
        .authenticatedContext("super_admin_uid", {
          email: SUPER_ADMIN_EMAIL,
          email_verified: true,
        })
        .firestore();
      await assertFails(
        saDb.doc("runtime_settings/subscription").set({
          clientId: "osvid",
          isSuspended: false,
          hardSuspendAt: new Date(Date.now() + 86400000 * 30),
        })
      );
    });

    it("normal staff cannot read provider-private system_settings (subscription/main_business)", async () => {
      const adminDb = testEnv.authenticatedContext("admin_staff").firestore();
      await assertFails(adminDb.doc("system_settings/subscription").get());
      await assertFails(adminDb.doc("system_settings/main_business").get());

      // But staff can read non-private system settings
      await assertSucceeds(adminDb.doc("system_settings/general_info").get());
    });

    it("verified Super Admin can read provider-private documents in system_settings", async () => {
      const saDb = testEnv
        .authenticatedContext("super_admin_uid", {
          email: SUPER_ADMIN_EMAIL,
          email_verified: true,
        })
        .firestore();

      await assertSucceeds(saDb.doc("system_settings/subscription").get());
      await assertSucceeds(saDb.doc("system_settings/main_business").get());
    });

    it("direct client writes to system_settings are sealed for ALL callers including Super Admin", async () => {
      // Staff cannot write
      const adminDb = testEnv.authenticatedContext("admin_staff").firestore();
      await assertFails(
        adminDb.doc("system_settings/general_info").set({ companyName: "Tampered" })
      );

      // Super Admin client write is also denied (must use server Admin API)
      const saDb = testEnv
        .authenticatedContext("super_admin_uid", {
          email: SUPER_ADMIN_EMAIL,
          email_verified: true,
        })
        .firestore();

      await assertFails(
        saDb.doc("system_settings/subscription").set({ plan: "unlimited" })
      );
      await assertFails(
        saDb.doc("system_settings/general_info").set({ companyName: "Tampered" })
      );
    });
  });

  // ==========================================================================
  // 4. MALFORMED RUNTIME SUBSCRIPTION CASES (FAIL-CLOSED SEMANTICS)
  // ==========================================================================
  describe("Malformed Runtime Subscription Fail-Closed Semantics", () => {
    const futureDate = new Date(Date.now() + 86400000 * 30);
    const pastDate = new Date(Date.now() - 86400000 * 5);

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.collection("users").doc("pm_user").set({
          role: "manager",
          isActive: true,
          permissions: { canManageProducts: true },
        });
      });
    });

    it("missing subscription doc fails closed (staff cannot write products)", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc("runtime_settings/subscription").delete();
      });

      const pmDb = testEnv.authenticatedContext("pm_user").firestore();
      await assertFails(
        pmDb.collection("products").doc("prod_fail").set({
          name: "Test Acid",
          price: 1000,
          stockQuantity: 0,
        })
      );
    });

    it("malformed subscription - missing clientId fails closed", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc("runtime_settings/subscription").set({
          isSuspended: false,
          hardSuspendAt: futureDate,
        });
      });

      const pmDb = testEnv.authenticatedContext("pm_user").firestore();
      await assertFails(
        pmDb.collection("products").doc("prod_fail").set({
          name: "Test Acid",
          price: 1000,
          stockQuantity: 0,
        })
      );
    });

    it("malformed subscription - clientId != 'osvid' fails closed", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc("runtime_settings/subscription").set({
          clientId: "unauthorized_tenant",
          isSuspended: false,
          hardSuspendAt: futureDate,
        });
      });

      const pmDb = testEnv.authenticatedContext("pm_user").firestore();
      await assertFails(
        pmDb.collection("products").doc("prod_fail").set({
          name: "Test Acid",
          price: 1000,
          stockQuantity: 0,
        })
      );
    });

    it("malformed subscription - missing isSuspended fails closed", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc("runtime_settings/subscription").set({
          clientId: "osvid",
          hardSuspendAt: futureDate,
        });
      });

      const pmDb = testEnv.authenticatedContext("pm_user").firestore();
      await assertFails(
        pmDb.collection("products").doc("prod_fail").set({
          name: "Test Acid",
          price: 1000,
          stockQuantity: 0,
        })
      );
    });

    it("malformed subscription - isSuspended wrong type (not bool) fails closed", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc("runtime_settings/subscription").set({
          clientId: "osvid",
          isSuspended: "false", // String, not bool
          hardSuspendAt: futureDate,
        });
      });

      const pmDb = testEnv.authenticatedContext("pm_user").firestore();
      await assertFails(
        pmDb.collection("products").doc("prod_fail").set({
          name: "Test Acid",
          price: 1000,
          stockQuantity: 0,
        })
      );
    });

    it("malformed subscription - missing hardSuspendAt fails closed", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc("runtime_settings/subscription").set({
          clientId: "osvid",
          isSuspended: false,
        });
      });

      const pmDb = testEnv.authenticatedContext("pm_user").firestore();
      await assertFails(
        pmDb.collection("products").doc("prod_fail").set({
          name: "Test Acid",
          price: 1000,
          stockQuantity: 0,
        })
      );
    });

    it("malformed subscription - hardSuspendAt wrong type (string) fails closed", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc("runtime_settings/subscription").set({
          clientId: "osvid",
          isSuspended: false,
          hardSuspendAt: "2026-12-31T23:59:59Z", // String, not timestamp
        });
      });

      const pmDb = testEnv.authenticatedContext("pm_user").firestore();
      await assertFails(
        pmDb.collection("products").doc("prod_fail").set({
          name: "Test Acid",
          price: 1000,
          stockQuantity: 0,
        })
      );
    });

    it("expired hardSuspendAt fails closed for normal staff writes", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc("runtime_settings/subscription").set({
          clientId: "osvid",
          isSuspended: false,
          hardSuspendAt: pastDate, // Expired
        });
      });

      const pmDb = testEnv.authenticatedContext("pm_user").firestore();
      await assertFails(
        pmDb.collection("products").doc("prod_fail").set({
          name: "Test Acid",
          price: 1000,
          stockQuantity: 0,
        })
      );
    });

    it("valid operational runtime state allows authorized staff operation", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc("runtime_settings/subscription").set({
          clientId: "osvid",
          isSuspended: false,
          hardSuspendAt: futureDate,
        });
      });

      const pmDb = testEnv.authenticatedContext("pm_user").firestore();
      await assertSucceeds(
        pmDb.collection("products").doc("prod_valid").set({
          name: "Valid Operational Chemical",
          price: 5000,
          stockQuantity: 0,
        })
      );
    });

    it("Super Admin recovery allows product writes during suspension while keeping runtime_settings write sealed", async () => {
      // Set suspended state
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc("runtime_settings/subscription").set({
          clientId: "osvid",
          isSuspended: true,
          hardSuspendAt: pastDate,
        });
      });

      const saDb = testEnv
        .authenticatedContext("super_admin_uid", {
          email: SUPER_ADMIN_EMAIL,
          email_verified: true,
        })
        .firestore();

      // Super Admin recovery write succeeds on product collection
      await assertSucceeds(
        saDb.collection("products").doc("prod_recovery").set({
          name: "Emergency Recovery Product",
          price: 9000,
          stockQuantity: 0,
        })
      );

      // But client write to runtime_settings/subscription is still denied
      await assertFails(
        saDb.doc("runtime_settings/subscription").update({ isSuspended: false })
      );
    });
  });

  // ==========================================================================
  // 5. DISCOUNTS & COUPON COUNTERS BOUNDARY (PACKET 5B)
  // ==========================================================================
  describe("Discounts & Coupon Counter Boundary", () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.collection("users").doc("disc_mgr").set({
          role: "manager",
          isActive: true,
          permissions: { canManageDiscounts: true },
        });
        await db.collection("discounts").doc("coupon_1").set({
          code: "PROMO10",
          percentage: 10,
          usageCount: 5,
          reservedUsageCount: 0,
          description: "Ten percent off",
        });
        await db.collection("discounts").doc("coupon_active_reservations").set({
          code: "LOCKED20",
          percentage: 20,
          usageCount: 2,
          reservedUsageCount: 3,
        });
      });
    });

    it("customer cannot write or mutate discount records", async () => {
      const custDb = testEnv.authenticatedContext("cust_1").firestore();
      await assertFails(
        custDb.collection("discounts").doc("cust_hack").set({ code: "FREE" })
      );
      await assertFails(
        custDb.collection("discounts").doc("coupon_1").update({ percentage: 99 })
      );
      await assertFails(
        custDb.collection("discounts").doc("coupon_1").delete()
      );
    });

    it("authorized discount manager cannot directly modify usageCount", async () => {
      const mgrDb = testEnv.authenticatedContext("disc_mgr").firestore();
      await assertFails(
        mgrDb.collection("discounts").doc("coupon_1").update({
          usageCount: 10,
        })
      );
    });

    it("authorized discount manager cannot directly modify reservedUsageCount", async () => {
      const mgrDb = testEnv.authenticatedContext("disc_mgr").firestore();
      await assertFails(
        mgrDb.collection("discounts").doc("coupon_1").update({
          reservedUsageCount: 5,
        })
      );
    });

    it("authorized discount manager can update non-counter fields", async () => {
      const mgrDb = testEnv.authenticatedContext("disc_mgr").firestore();
      await assertSucceeds(
        mgrDb.collection("discounts").doc("coupon_1").update({
          description: "Updated promotional discount description",
        })
      );
    });

    it("creating discount with non-zero usageCount or reservedUsageCount fails", async () => {
      const mgrDb = testEnv.authenticatedContext("disc_mgr").firestore();
      await assertFails(
        mgrDb.collection("discounts").doc("new_invalid_usage").set({
          code: "BAD1",
          usageCount: 1,
        })
      );
      await assertFails(
        mgrDb.collection("discounts").doc("new_invalid_reserved").set({
          code: "BAD2",
          reservedUsageCount: 1,
        })
      );
    });

    it("deleting discount while reservedUsageCount > 0 fails", async () => {
      const mgrDb = testEnv.authenticatedContext("disc_mgr").firestore();
      await assertFails(
        mgrDb.collection("discounts").doc("coupon_active_reservations").delete()
      );

      // Deleting when reservedUsageCount == 0 succeeds
      await assertSucceeds(
        mgrDb.collection("discounts").doc("coupon_1").delete()
      );
    });
  });

  // ==========================================================================
  // 6. FIRESTORE COMMERCE INTERNALS
  // ==========================================================================
  describe("Firestore Commerce Internals", () => {
    it("checkout_sessions browser read and write are denied", async () => {
      const custCtx = testEnv.authenticatedContext("cust_1");
      const db = custCtx.firestore();

      await assertFails(
        db.collection("checkout_sessions").doc("sess_1").set({ amount: 5000 })
      );
      await assertFails(db.collection("checkout_sessions").doc("sess_1").get());
    });

    it("payment_transactions browser read and write are denied", async () => {
      const custCtx = testEnv.authenticatedContext("cust_1");
      const db = custCtx.firestore();

      await assertFails(
        db.collection("payment_transactions").doc("txn_1").set({ status: "success" })
      );
      await assertFails(db.collection("payment_transactions").doc("txn_1").get());
    });

    it("inventory_movements client write denied", async () => {
      const custCtx = testEnv.authenticatedContext("cust_1");
      const db = custCtx.firestore();

      await assertFails(
        db.collection("inventory_movements").doc("mov_1").set({ delta: 50 })
      );
    });

    it("reservedQuantity client write denied", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("products").doc("prod_1").set({
          name: "Test",
          stockQuantity: 10,
          reservedQuantity: 0,
        });
      });

      const custCtx = testEnv.authenticatedContext("cust_1");
      const db = custCtx.firestore();

      await assertFails(
        db.collection("products").doc("prod_1").update({
          reservedQuantity: 5,
        })
      );
    });
  });

  // ==========================================================================
  // 7. STORAGE RULES & MEDIA SECURITY
  // ==========================================================================
  describe("Storage Rules & Media Security", () => {
    const validJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.collection("users").doc("pm_storage").set({
          role: "manager",
          isActive: true,
          permissions: { canManageProducts: true },
        });
        await db.collection("users").doc("unauth_storage").set({
          role: "manager",
          isActive: true,
          permissions: {},
        });
      });
    });

    it("public can read seeded product assets unauthenticated", async () => {
      // 1. Seed a real test object using Super Admin context
      const saCtx = testEnv.authenticatedContext("sa_storage", {
        email: SUPER_ADMIN_EMAIL,
        email_verified: true,
      });
      const saRef = saCtx.storage().ref("products/public-read.jpg");
      await asPromise(saRef.put(validJpgBuffer, { contentType: "image/jpeg" }));

      // 2. Unauthenticated caller reads the object metadata
      const unauthCtx = testEnv.unauthenticatedContext();
      const storage = unauthCtx.storage();
      const fileRef = storage.ref("products/public-read.jpg");

      await assertSucceeds(fileRef.getMetadata());
    });

    it("customer cannot upload catalogue assets", async () => {
      const custCtx = testEnv.authenticatedContext("customer_uid", {
        email: "customer@example.com",
      });
      const fileRef = custCtx.storage().ref("products/sample.jpg");

      await assertFails(
        asPromise(fileRef.put(validJpgBuffer, { contentType: "image/jpeg" }))
      );
    });

    it("Product Manager can upload valid image while operational", async () => {
      const pmCtx = testEnv.authenticatedContext("pm_storage");
      const fileRef = pmCtx.storage().ref("products/sample.jpg");

      await assertSucceeds(
        asPromise(fileRef.put(validJpgBuffer, { contentType: "image/jpeg" }))
      );
    });

    it("Manager without catalogue permission cannot upload", async () => {
      const unauthCtx = testEnv.authenticatedContext("unauth_storage");
      const fileRef = unauthCtx.storage().ref("products/sample.jpg");

      await assertFails(
        asPromise(fileRef.put(validJpgBuffer, { contentType: "image/jpeg" }))
      );
    });

    it("suspended business staff upload denied", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc("runtime_settings/subscription").update({
          isSuspended: true,
        });
      });

      const pmCtx = testEnv.authenticatedContext("pm_storage");
      const fileRef = pmCtx.storage().ref("products/sample.jpg");

      await assertFails(
        asPromise(fileRef.put(validJpgBuffer, { contentType: "image/jpeg" }))
      );
    });

    it("verified Super Admin recovery upload allowed even when suspended", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc("runtime_settings/subscription").update({
          isSuspended: true,
        });
      });

      const saCtx = testEnv.authenticatedContext("sa_storage", {
        email: SUPER_ADMIN_EMAIL,
        email_verified: true,
      });
      const fileRef = saCtx.storage().ref("products/sample.jpg");

      await assertSucceeds(
        asPromise(fileRef.put(validJpgBuffer, { contentType: "image/jpeg" }))
      );
    });

    it("invalid MIME format (e.g. text/html or application/pdf) denied", async () => {
      const pmCtx = testEnv.authenticatedContext("pm_storage");
      const fileRef = pmCtx.storage().ref("products/bad.html");

      await assertFails(
        asPromise(fileRef.put(Buffer.from("<h1>Attack</h1>"), { contentType: "text/html" }))
      );
    });

    it("oversized upload (> 5MB) denied", async () => {
      const pmCtx = testEnv.authenticatedContext("pm_storage");
      const fileRef = pmCtx.storage().ref("products/huge.jpg");
      const hugeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6 MB

      await assertFails(
        asPromise(fileRef.put(hugeBuffer, { contentType: "image/jpeg" }))
      );
    });

    it("authorized deletion works under intended semantics without contentType check", async () => {
      // First seed an image as Super Admin
      const saCtx = testEnv.authenticatedContext("sa_storage", {
        email: SUPER_ADMIN_EMAIL,
        email_verified: true,
      });
      const saRef = saCtx.storage().ref("products/to_delete.jpg");
      await asPromise(saRef.put(validJpgBuffer, { contentType: "image/jpeg" }));

      // Now Product Manager deletes it
      const pmCtx = testEnv.authenticatedContext("pm_storage");
      const pmRef = pmCtx.storage().ref("products/to_delete.jpg");

      await assertSucceeds(pmRef.delete());
    });
  });
});
