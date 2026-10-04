import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rulesPath = path.resolve(process.cwd(), "firestore.rules");
const storageRulesPath = path.resolve(process.cwd(), "storage.rules");

test("firestore.rules exists and contains critical security collections and protections", () => {
  assert.equal(fs.existsSync(rulesPath), true, "firestore.rules file must exist");
  const content = fs.readFileSync(rulesPath, "utf8");

  // Syntax and version
  assert.match(content, /rules_version\s*=\s*'2';/);
  assert.match(content, /service cloud.firestore/);

  // Core helper functions
  assert.match(content, /function isAuthenticated\(\)/);
  assert.match(content, /function isSuperAdmin\(\)/);
  assert.match(content, /function isAdmin\(\)/);
  assert.match(content, /function isManager\(\)/);
  assert.match(content, /function hasManagerPermission\(perm\)/);

  // Primary Super Admin email enforcement
  assert.match(content, /abolarinwaemmanuelfree@gmail\.com/);

  // Collections covered
  assert.match(content, /match \/users\/\{userId\}/);
  assert.match(content, /match \/products\/\{productId\}/);
  assert.match(content, /match \/categories\/\{categoryId\}/);
  assert.match(content, /match \/orders\/\{orderId\}/);
  assert.match(content, /match \/discounts\/\{discountId\}/);
  assert.match(content, /match \/system_settings\/\{settingId\}/);
  assert.match(content, /match \/site_content\/\{contentId\}/);
  assert.match(content, /match \/contact_submissions\/\{submissionId\}/);
  assert.match(content, /match \/back_in_stock_requests\/\{requestId\}/);
});

test("firestore.rules enforces field allowlist and protects server-owned fields on user update", () => {
  const content = fs.readFileSync(rulesPath, "utf8");

  // Registration allows role 'user' only (unless Super Admin)
  assert.match(content, /request\.resource\.data\.role == 'user'/);

  // Field-level allowlisting using diff
  assert.match(content, /affectedKeys\(\)\.hasOnly\(/);
  assert.match(content, /displayName/);
  assert.match(content, /phoneNumber/);

  // Server-owned fields protected
  assert.match(content, /!request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasAny\(/);
  assert.match(content, /role/);
  assert.match(content, /permissions/);
  assert.match(content, /isActive/);
  assert.match(content, /totalOrders/);
  assert.match(content, /totalSpent/);
  assert.match(content, /subscription/);
});

test("firestore.rules enforces public reads and staff-only writes for products catalog", () => {
  const content = fs.readFileSync(rulesPath, "utf8");

  // Products: public read, staff write
  const productBlock = content.slice(content.indexOf("match /products/{productId}"));
  assert.match(productBlock, /allow read:\s*if true;/);
  assert.match(productBlock, /hasManagerPermission\('canManageProducts'\)/);
});

test("firestore.rules denies direct client order creation entirely (server Admin SDK required)", () => {
  const content = fs.readFileSync(rulesPath, "utf8");

  const orderBlock = content.slice(content.indexOf("match /orders/{orderId}"));
  const nextMatch = orderBlock.indexOf("match /discounts");
  const blockSnippet = orderBlock.slice(0, nextMatch);

  // Client-side order creation is completely denied
  assert.match(blockSnippet, /allow create:\s*if false;/);

  // Order updates require canManageOrders permission
  assert.match(blockSnippet, /hasManagerPermission\('canManageOrders'\)/);
});

test("firestore.rules restricts system_settings read to staff and write strictly to Super Admin", () => {
  const content = fs.readFileSync(rulesPath, "utf8");

  const systemBlock = content.slice(content.indexOf("match /system_settings/{settingId}"));
  const nextMatch = systemBlock.indexOf("match /site_content");
  const blockSnippet = systemBlock.slice(0, nextMatch);

  // Not exposed to unauthenticated public visitors
  assert.match(blockSnippet, /allow read:\s*if isStaff\(\) \|\| isSuperAdmin\(\);/);
  assert.match(blockSnippet, /allow write:\s*if isSuperAdmin\(\);/);
});

test("storage.rules enforces default deny, granular permissions, and strict image constraints", () => {
  assert.equal(fs.existsSync(storageRulesPath), true, "storage.rules file must exist");
  const content = fs.readFileSync(storageRulesPath, "utf8");

  assert.match(content, /service firebase\.storage/);
  assert.match(content, /match \/products\/\{allPaths=\*\*\}/);
  assert.match(content, /hasManagerPermission\('canManageProducts'\)/);
  assert.match(content, /hasManagerPermission\('canManageWebsite'\)/);
  assert.match(content, /match \/users\/\{userId\}\/\{allPaths=\*\*\}/);
  assert.match(content, /contentType\.matches\('image\/\.\*'\)/);

  // Default deny for unmatched storage paths
  assert.match(content, /match \/\{allPaths=\*\*\}\s*\{\s*allow read, write:\s*if false;\s*\}/);
});
