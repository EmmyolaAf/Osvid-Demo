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
  // 3. FIRESTORE PROVIDER & SUBSCRIPTION BOUNDARY
  // ==========================================================================
  describe("Firestore Provider & Subscription Boundary", () => {
    it("subscription/runtime_settings is private from normal staff", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("users").doc("admin_staff").set({
          role: "admin",
          isActive: true,
        });
      });

      const adminCtx = testEnv.authenticatedContext("admin_staff");
      const db = adminCtx.firestore();

      await assertFails(db.doc("runtime_settings/subscription").get());
    });

    it("missing runtime subscription state blocks staff operational writes", async () => {
      // Remove subscription doc
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc("runtime_settings/subscription").delete();
        await ctx.firestore().collection("users").doc("admin_staff").set({
          role: "admin",
          isActive: true,
        });
      });

      const adminCtx = testEnv.authenticatedContext("admin_staff");
      const db = adminCtx.firestore();

      await assertFails(
        db.collection("products").doc("prod_new").set({
          name: "Blocked Acid",
          stockQuantity: 0,
          isActive: true,
        })
      );
    });

    it("Super Admin recovery semantics allow reading and writing subscription", async () => {
      const saCtx = testEnv.authenticatedContext("super_admin_uid", {
        email: SUPER_ADMIN_EMAIL,
        email_verified: true,
      });
      const db = saCtx.firestore();

      await assertSucceeds(db.doc("runtime_settings/subscription").get());
      await assertSucceeds(
        db.doc("runtime_settings/subscription").set({
          clientId: "osvid",
          isSuspended: false,
          hardSuspendAt: new Date(Date.now() + 86400000 * 30),
        })
      );
    });
  });

  // ==========================================================================
  // 4. FIRESTORE COMMERCE INTERNALS
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
  // 5. STORAGE RULES & MEDIA SECURITY
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

    it("public can read product assets", async () => {
      const unauthCtx = testEnv.unauthenticatedContext();
      const storage = unauthCtx.storage();
      const fileRef = storage.ref("products/sample.jpg");

      // Reading metadata/download
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
