import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { UserRole, ManagerPermissions, UserProfile } from "@/types/auth";
import type { DecodedIdToken } from "firebase-admin/auth";

/**
 * Single Primary Super Admin bootstrap email.
 * Maintained as an emergency bootstrap safeguard against lockout,
 * but server authorization always verifies the cryptographically signed ID token first.
 */
export const PRIMARY_SUPER_ADMIN_EMAIL = "abolarinwaemmanuelfree@gmail.com";

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase();
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export interface ServerAuthUser {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  isCustomer: boolean;
  permissions?: ManagerPermissions;
  isActive: boolean;
  customTitle?: string;
  tokenClaims: Record<string, any>;
}

/**
 * Extracts Bearer token from the HTTP Authorization header.
 */
export function extractBearerToken(req: NextRequest | Request): string | null {
  const authHeader =
    req.headers.get("Authorization") ||
    req.headers.get("authorization");

  if (!authHeader) return null;

  const parts = authHeader.trim().split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  const token = parts[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Resolves a verified caller into a ServerAuthUser with trusted roles & permissions.
 */
export async function resolveServerUser(
  decodedToken: DecodedIdToken
): Promise<ServerAuthUser> {
  const uid = decodedToken.uid;
  const tokenEmail = (decodedToken.email || "").trim().toLowerCase();

  // 1. Determine baseline role:
  // Sole authorized Super Admin is PRIMARY_SUPER_ADMIN_EMAIL.
  // Any token attempting to claim 'super_admin' with a different email is demoted to 'admin' or checked in Firestore.
  const isSuper = isSuperAdminEmail(tokenEmail);

  let effectiveRole: UserRole = isSuper
    ? "super_admin"
    : (decodedToken.role as UserRole) || "user";

  if (!isSuper && effectiveRole === "super_admin") {
    // Prevent privilege escalation via forged claims
    effectiveRole = "admin";
  }

  let permissions = (decodedToken.permissions as ManagerPermissions) || undefined;
  let customTitle = (decodedToken.customTitle as string) || undefined;
  let isActive = true;

  // 2. Fetch live Firestore profile for real-time status and permission synchronization
  try {
    const userDocSnap = await adminDb.collection("users").doc(uid).get();
    if (userDocSnap.exists) {
      const data = userDocSnap.data() as UserProfile;
      if (data) {
        if (data.isActive === false) {
          isActive = false;
        }

        // If not super admin, adopt authoritative Firestore role & permissions
        if (!isSuper) {
          if (data.role && data.role !== "super_admin") {
            effectiveRole = data.role;
          } else if (data.role === "super_admin") {
            effectiveRole = "admin"; // clamp
          }

          if (data.permissions) {
            permissions = data.permissions;
          }
          if (data.customTitle) {
            customTitle = data.customTitle;
          }
        }
      }
    }
  } catch (dbErr: any) {
    console.warn("Server auth: Firestore profile lookup warning:", dbErr.message);
  }

  // 3. Enforce active status
  if (!isActive) {
    throw new AuthError("Forbidden: This user account has been deactivated", 403);
  }

  const isSuperAdmin = effectiveRole === "super_admin" && isSuper;
  const isAdmin = isSuperAdmin || effectiveRole === "admin";
  const isManager = effectiveRole === "manager";
  const isStaff = isSuperAdmin || isAdmin || isManager;
  const isCustomer = effectiveRole === "user";

  return {
    uid,
    email: tokenEmail,
    displayName: (decodedToken.name as string) || decodedToken.email?.split("@")[0] || "User",
    role: effectiveRole,
    isSuperAdmin,
    isAdmin,
    isManager,
    isStaff,
    isCustomer,
    permissions,
    isActive: true,
    customTitle,
    tokenClaims: decodedToken as Record<string, any>,
  };
}

/**
 * Authenticates request using Firebase ID Token and returns the verified caller.
 */
export async function requireAuthenticatedUser(
  req: NextRequest | Request
): Promise<ServerAuthUser> {
  const token = extractBearerToken(req);

  if (!token) {
    throw new AuthError(
      "Unauthorized: Missing or invalid Authorization header. Expected Bearer token.",
      401
    );
  }

  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token, true); // checkRevoked = true
  } catch (verifyErr: any) {
    if (verifyErr.code === "auth/id-token-expired") {
      throw new AuthError("Unauthorized: Authentication token has expired", 401);
    }
    if (verifyErr.code === "auth/id-token-revoked") {
      throw new AuthError("Unauthorized: Authentication token has been revoked", 401);
    }
    throw new AuthError(
      `Unauthorized: Invalid authentication token (${verifyErr.message || "Verification failed"})`,
      401
    );
  }

  return resolveServerUser(decodedToken);
}

/**
 * Requires caller to hold one of the allowed roles.
 */
export async function requireRole(
  req: NextRequest | Request,
  allowedRoles: UserRole[]
): Promise<ServerAuthUser> {
  const user = await requireAuthenticatedUser(req);

  if (!allowedRoles.includes(user.role)) {
    throw new AuthError(
      `Forbidden: Required role [${allowedRoles.join(", ")}], but caller has role '${user.role}'`,
      403
    );
  }

  return user;
}

/**
 * Requires caller to be the verified Super Admin.
 */
export async function requireSuperAdmin(
  req: NextRequest | Request
): Promise<ServerAuthUser> {
  const user = await requireAuthenticatedUser(req);

  if (!user.isSuperAdmin) {
    throw new AuthError(
      "Forbidden: Super Admin privileges are required to perform this action",
      403
    );
  }

  return user;
}

/**
 * Requires caller to be an Admin or Super Admin.
 */
export async function requireAdminOrSuperAdmin(
  req: NextRequest | Request
): Promise<ServerAuthUser> {
  const user = await requireAuthenticatedUser(req);

  if (!user.isAdmin) {
    throw new AuthError(
      "Forbidden: Administrator or Super Admin privileges are required",
      403
    );
  }

  return user;
}

/**
 * Checks whether user has a specific granular manager permission.
 */
export function hasPermission(
  user: ServerAuthUser,
  permission: keyof ManagerPermissions
): boolean {
  if (user.isSuperAdmin || user.isAdmin) return true;
  if (user.isManager && user.permissions) {
    return Boolean(user.permissions[permission]);
  }
  return false;
}

export interface TargetStaffAccount {
  uid: string;
  email?: string | null;
  role?: string | null;
  isActive?: boolean;
}

/**
 * Validates that an account target role is a recognized staff role (admin or manager).
 * Throws 400 if target is a customer ('user') or undefined, preventing customer account tampering via staff endpoints.
 */
export function assertStaffEndpointTarget(targetRole?: string | null): void {
  if (!targetRole || targetRole === "user") {
    throw new AuthError(
      "Forbidden: Staff administration endpoints cannot be used to manage customer accounts",
      400
    );
  }
  if (targetRole !== "admin" && targetRole !== "manager" && targetRole !== "super_admin") {
    throw new AuthError(
      "Forbidden: Target is not a recognized staff account",
      400
    );
  }
}

/**
 * Validates role creation permissions.
 * Super Admin may create 'admin' or 'manager'.
 * Admin may create 'manager' only.
 * No one may create 'super_admin' or 'user' via staff creation API.
 */
export function assertCanCreateStaffRole(
  caller: ServerAuthUser,
  requestedRole: string | undefined,
  targetEmail: string
): UserRole {
  const cleanEmail = targetEmail.trim().toLowerCase();

  // Prevent creation of Super Admin accounts or using primary owner email
  if (requestedRole === "super_admin" || isSuperAdminEmail(cleanEmail)) {
    throw new AuthError("Forbidden: Super Admin accounts cannot be created via API", 403);
  }

  // Prevent creating customer accounts via staff administration endpoint
  if (requestedRole === "user") {
    throw new AuthError("Forbidden: Staff administration endpoints cannot be used to create customer accounts", 400);
  }

  if (caller.isSuperAdmin) {
    return requestedRole === "manager" ? "manager" : "admin";
  }

  // Caller is Admin: must only create manager
  if (requestedRole && requestedRole !== "manager") {
    throw new AuthError("Forbidden: Administrators are only permitted to create Manager accounts", 403);
  }

  return "manager";
}

/**
 * Enforces staff management permissions for actions (update, toggle-status, delete).
 */
export function assertCanManageTargetStaff(
  caller: ServerAuthUser,
  target: TargetStaffAccount
): void {
  const isTargetSuper = isSuperAdminEmail(target.email) || target.role === "super_admin";

  // Prevent tampering with customer accounts via staff endpoints
  assertStaffEndpointTarget(target.role);

  // If target is Super Admin:
  if (isTargetSuper) {
    if (!caller.isSuperAdmin) {
      throw new AuthError("Forbidden: Administrators cannot modify or manage Super Admin accounts", 403);
    }
  }

  // If caller is Admin (not Super Admin):
  if (!caller.isSuperAdmin) {
    // Admin cannot manage another Admin
    if (target.role === "admin" && target.uid !== caller.uid) {
      throw new AuthError("Forbidden: Administrators cannot manage other Administrator accounts", 403);
    }
    // Admin can only manage Managers (or self for allowed profile edits)
    if (target.role !== "manager" && target.uid !== caller.uid) {
      throw new AuthError("Forbidden: Administrators are only permitted to manage Manager accounts", 403);
    }
  }
}

/**
 * Enforces constraints when updating staff account fields (role, isActive).
 */
export function assertCanUpdateStaffFields(
  caller: ServerAuthUser,
  target: TargetStaffAccount,
  updates: { role?: string; isActive?: boolean }
): void {
  const isTargetSuper = isSuperAdminEmail(target.email) || target.role === "super_admin";

  // 1. Super Admin protections
  if (isTargetSuper) {
    if (updates.isActive === false) {
      throw new AuthError("Forbidden: Cannot deactivate the primary Super Admin account", 403);
    }
    if (updates.role && updates.role !== "super_admin") {
      throw new AuthError("Forbidden: Cannot demote the primary Super Admin account", 403);
    }
  }

  // 2. Prevent granting 'super_admin' to anyone
  if (updates.role === "super_admin" && !isTargetSuper) {
    throw new AuthError("Forbidden: Cannot grant Super Admin role via update", 403);
  }

  // 3. Admin caller restrictions
  if (!caller.isSuperAdmin) {
    // Admin cannot promote a manager to admin or super_admin
    if (target.role === "manager" && updates.role && updates.role !== "manager") {
      throw new AuthError("Forbidden: Administrators cannot promote Managers to Administrator", 403);
    }

    // Admin editing self: cannot change own role or deactivate self
    if (target.uid === caller.uid) {
      if (updates.role && updates.role !== "admin") {
        throw new AuthError("Forbidden: Cannot alter your own administrative role", 403);
      }
      if (updates.isActive !== undefined && !updates.isActive) {
        throw new AuthError("Forbidden: Cannot deactivate your own administrator account", 403);
      }
    }
  }
}

/**
 * Enforces deletion constraints.
 */
export function assertCanDeleteStaff(
  caller: ServerAuthUser,
  target: TargetStaffAccount
): void {
  // Prevent self-deletion
  if (target.uid === caller.uid) {
    throw new AuthError("Forbidden: Self-deletion is not permitted", 400);
  }

  const isTargetSuper = isSuperAdminEmail(target.email) || target.role === "super_admin";
  if (isTargetSuper) {
    throw new AuthError("Forbidden: The primary Super Admin account cannot be deleted", 403);
  }

  assertStaffEndpointTarget(target.role);

  if (!caller.isSuperAdmin) {
    if (target.role === "admin") {
      throw new AuthError("Forbidden: Administrators cannot delete other Administrator accounts", 403);
    }
    if (target.role !== "manager") {
      throw new AuthError("Forbidden: Administrators are only permitted to delete Manager accounts", 403);
    }
  }
}

/**
 * Generates a cryptographically strong temporary password for new staff accounts.
 */
export function generateSecureTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  const randomValues = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
  } else {
    // Node.js fallback
    const nodeCrypto = require("node:crypto");
    const buf = nodeCrypto.randomBytes(16);
    for (let i = 0; i < 16; i++) randomValues[i] = buf[i];
  }
  let pwd = "Os#";
  for (let i = 0; i < 12; i++) {
    pwd += chars[randomValues[i] % chars.length];
  }
  return pwd + "9!";
}

/**
 * Standard HTTP response formatter for server auth errors.
 */
export function authErrorResponse(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status }
    );
  }

  const message = err instanceof Error ? err.message : "Internal Server Error";
  return NextResponse.json(
    { error: message },
    { status: 500 }
  );
}
