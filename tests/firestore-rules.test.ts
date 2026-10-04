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

test("firestore.rules enforces non-escalation and role immutability for users", () => {
  const content = fs.readFileSync(rulesPath, "utf8");

  // Registration allows role 'user' only (unless Super Admin)
  assert.match(content, /request\.resource\.data\.role == 'user'/);

  // Customer self-updates cannot change role, permissions, or isActive
  assert.match(content, /request\.resource\.data\.role == resource\.data\.role/);
  assert.match(content, /request\.resource\.data\.permissions == resource\.data\.permissions/);
  assert.match(content, /request\.resource\.data\.isActive == resource\.data\.isActive/);
});

test("firestore.rules enforces public reads and staff-only writes for products catalog", () => {
  const content = fs.readFileSync(rulesPath, "utf8");

  // Products: public read, staff write
  const productBlock = content.slice(content.indexOf("match /products/{productId}"));
  assert.match(productBlock, /allow read:\s*if true;/);
  assert.match(productBlock, /hasManagerPermission\('canManageProducts'\)/);
});

test("firestore.rules protects orders from client-side status and payment tampering", () => {
  const content = fs.readFileSync(rulesPath, "utf8");

  // Orders: create requires pending status
  assert.match(content, /request\.resource\.data\.paymentStatus == 'pending'/);
  assert.match(content, /request\.resource\.data\.orderStatus == 'pending'/);

  // Order updates require canManageOrders permission
  assert.match(content, /hasManagerPermission\('canManageOrders'\)/);
});

test("firestore.rules restricts system_settings (lease/killswitch) strictly to Super Admin", () => {
  const content = fs.readFileSync(rulesPath, "utf8");

  const systemBlock = content.slice(content.indexOf("match /system_settings/{settingId}"));
  const nextMatch = systemBlock.indexOf("match /site_content");
  const blockSnippet = systemBlock.slice(0, nextMatch);

  assert.match(blockSnippet, /allow read:\s*if true;/);
  assert.match(blockSnippet, /allow write:\s*if isSuperAdmin\(\);/);
});

test("storage.rules exists and secures files with appropriate constraints", () => {
  assert.equal(fs.existsSync(storageRulesPath), true, "storage.rules file must exist");
  const content = fs.readFileSync(storageRulesPath, "utf8");

  assert.match(content, /service firebase\.storage/);
  assert.match(content, /match \/products\/\{allPaths=\*\*\}/);
  assert.match(content, /match \/users\/\{userId\}\/\{allPaths=\*\*\}/);
  assert.match(content, /contentType\.matches\('image\/\.\*'\)/);
});
