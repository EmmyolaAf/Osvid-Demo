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

  // Client-side order creation, updates, and deletes are completely denied (Packet 3)
  assert.match(blockSnippet, /allow create:\s*if false;/);
  assert.match(blockSnippet, /allow update:\s*if false;/);
  assert.match(blockSnippet, /allow delete:\s*if false;/);
});

test("firestore.rules restricts system_settings read to Super Admin and staff excluding subscription docs", () => {
  const content = fs.readFileSync(rulesPath, "utf8");

  const systemBlock = content.slice(content.indexOf("match /system_settings/{settingId}"));
  const nextMatch = systemBlock.indexOf("match /site_content");
  const blockSnippet = systemBlock.slice(0, nextMatch);

  // Wildcard staff read explicitly excludes 'subscription' and 'main_business'
  assert.match(blockSnippet, /isSuperAdmin\(\)\s*\|\|\s*\(/);
  assert.match(blockSnippet, /isStaff\(\)/);
  assert.match(blockSnippet, /settingId\s*!=\s*['"]subscription['"]/);
  assert.match(blockSnippet, /settingId\s*!=\s*['"]main_business['"]/);
  assert.doesNotMatch(blockSnippet, /allow read:\s*if isStaff\(\)\s*\|\|\s*isSuperAdmin\(\);/);
  assert.match(blockSnippet, /allow write:\s*if isSuperAdmin\(\);/);
});

test("firestore.rules strictly restricts Super Admin to primary email and rejects token role", () => {
  const content = fs.readFileSync(rulesPath, "utf8");
  const superAdminFn = content.slice(content.indexOf("function isSuperAdmin()"));
  const nextFn = superAdminFn.indexOf("function userDocExists()");
  const fnBody = superAdminFn.slice(0, nextFn);

  // Must check the primary email
  assert.match(fnBody, /abolarinwaemmanuelfree@gmail\.com/);
  // Must NOT allow token.role == 'super_admin' as fallback
  assert.doesNotMatch(fnBody, /token\.role\s*==\s*['"]super_admin['"]/);
});

test("firestore.rules enforces live staff profile existence and active status (deactivated staff blocked)", () => {
  const content = fs.readFileSync(rulesPath, "utf8");

  // Live profile helpers
  assert.match(content, /function userDocExists\(\)/);
  assert.match(content, /function getUserData\(\)/);
  assert.match(content, /function isLiveActiveStaff\(\)/);

  // Live active check requires userDocExists and isActive == true
  assert.match(content, /userDocExists\(\)\s*&&\s*getUserData\(\)\.isActive\s*==\s*true/);

  // isAdmin and isManager both require isLiveActiveStaff
  assert.match(content, /function isAdmin\(\)\s*\{\s*return isSuperAdmin\(\)\s*\|\|\s*\(\s*isLiveActiveStaff\(\)/);
  assert.match(content, /function isManager\(\)\s*\{\s*return isLiveActiveStaff\(\)\s*&&\s*getUserData\(\)\.role\s*==\s*'manager';/);

  // hasManagerPermission relies on live profile permissions, NOT request.auth.token
  assert.match(content, /getUserData\(\)\.permissions\[perm\]\s*==\s*true/);
  assert.doesNotMatch(content, /request\.auth\.token\.permissions/);
});

test("firestore.rules customer self-update strictly forbids email, lastLoginAt, and server-owned metrics", () => {
  const content = fs.readFileSync(rulesPath, "utf8");
  const updateBlock = content.slice(content.indexOf("match /users/{userId}"));
  const allowUpdateSection = updateBlock.slice(updateBlock.indexOf("allow update:"));
  const endUpdate = allowUpdateSection.indexOf("allow delete:");
  const updateRule = allowUpdateSection.slice(0, endUpdate);

  // Customer cannot change authentication email directly
  assert.match(updateRule, /'email'/);
  // Customer cannot touch lastLoginAt
  assert.match(updateRule, /'lastLoginAt'/);
  // Customer cannot touch metrics or server state
  assert.match(updateRule, /'totalOrders'/);
  assert.match(updateRule, /'totalSpent'/);
  assert.match(updateRule, /'lastOrderDate'/);
  assert.match(updateRule, /'subscription'/);
  assert.match(updateRule, /'role'/);
  assert.match(updateRule, /'permissions'/);
  assert.match(updateRule, /'isActive'/);
  assert.match(updateRule, /'createdBy'/);
  assert.match(updateRule, /'createdAt'/);
});

test("storage.rules enforces strict primary Super Admin and cross-service live Firestore lookups", () => {
  assert.equal(fs.existsSync(storageRulesPath), true, "storage.rules file must exist");
  const content = fs.readFileSync(storageRulesPath, "utf8");

  // Strict Super Admin email
  assert.match(content, /abolarinwaemmanuelfree@gmail\.com/);
  assert.doesNotMatch(content, /token\.role\s*==\s*['"]super_admin['"]/);

  // Cross-service Firestore lookups
  assert.match(content, /firestore\.exists\(\/databases\/\(default\)\/documents\/users\/\$\(request\.auth\.uid\)\)/);
  assert.match(content, /firestore\.get\(\/databases\/\(default\)\/documents\/users\/\$\(request\.auth\.uid\)\)\.data/);
  assert.match(content, /getUserData\(\)\.isActive\s*==\s*true/);
  assert.match(content, /getUserData\(\)\.permissions\[perm\]\s*==\s*true/);

  // Default deny unmatched paths
  assert.match(content, /match \/\{allPaths=\*\*\}\s*\{\s*allow read, write:\s*if false;\s*\}/);
});
