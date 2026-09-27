import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
  UserCredential,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./client";
import { UserProfile, UserRole } from "@/types/auth";

export const PRIMARY_SUPER_ADMIN_EMAIL = "abolarinwaemmanuelfree@gmail.com";

export interface AuthActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Promise wrapper with strict timeout rejection
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 9000, timeoutMsg = "Request timed out"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMsg));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Check if an email is strictly the single authorized Super Admin
 */
export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase();
}

/**
 * Fetch and verify a user profile from Firestore users collection
 */
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDocRef = doc(db, "users", uid);
    const snap = await withTimeout(getDoc(userDocRef), 6000, "Database profile query timed out");
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      // Enforce single super admin rule at the data retrieval layer
      if (data.role === "super_admin" && !isSuperAdminEmail(data.email)) {
        data.role = "admin";
      }
      return data;
    }
    return null;
  } catch (error) {
    console.error("fetchUserProfile error:", error);
    return null;
  }
}

/**
 * Authenticate user with Firebase and resolve their verified Firestore profile
 */
export async function authenticateAndVerifyUser(
  email: string,
  pass: string
): Promise<AuthActionResult<{ user: User; profile: UserProfile }>> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !pass) {
    return {
      success: false,
      error: "Please provide both email address and password.",
    };
  }

  try {
    // 1. Firebase Auth Sign-in with timeout harness
    const cred: UserCredential = await withTimeout(
      signInWithEmailAndPassword(auth, cleanEmail, pass),
      10000,
      "Sign in timed out. Please check your network connection."
    );

    // 2. Extract Auth Token Custom Claims & Firestore Profile
    const tokenResult = await cred.user.getIdTokenResult(true);
    const tokenClaims = (tokenResult?.claims as any) || {};

    let profile = await fetchUserProfile(cred.user.uid);

    const isSuper = isSuperAdminEmail(cleanEmail);
    const resolvedRole: UserRole = isSuper
      ? "super_admin"
      : tokenClaims.role || profile?.role || "user";

    if (!profile) {
      // Auto-provision profile from Firebase Auth and Token Claims
      profile = {
        uid: cred.user.uid,
        email: cleanEmail,
        displayName: cred.user.displayName || cleanEmail.split("@")[0],
        photoURL: cred.user.photoURL || "",
        phoneNumber: tokenClaims.phoneNumber || cred.user.phoneNumber || "",
        customTitle: tokenClaims.customTitle || (resolvedRole === "admin" ? "Tenant Store Account" : ""),
        role: resolvedRole,
        permissions: tokenClaims.permissions || {
          canManageProducts: true,
          canManageOrders: true,
          canViewFinancials: resolvedRole === "admin",
          canManageWebsite: resolvedRole === "admin",
          canManageCustomers: true,
          canManageDiscounts: resolvedRole === "admin",
        },
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      try {
        await withTimeout(
          setDoc(doc(db, "users", cred.user.uid), profile, { merge: true }),
          5000,
          "Profile initialization write timed out"
        );
      } catch (writeErr) {
        console.warn("Could not save initial profile to Firestore:", writeErr);
      }
    } else {
      // Sync latest role and permissions if claims override
      if (resolvedRole) {
        profile.role = resolvedRole;
      }
      if (tokenClaims.permissions) {
        profile.permissions = tokenClaims.permissions;
      }
      if (tokenClaims.customTitle) {
        profile.customTitle = tokenClaims.customTitle;
      }
    }

    // 3. Deactivated account guard
    if (!profile.isActive) {
      await signOut(auth);
      return {
        success: false,
        error: "Your account has been deactivated. Please contact the platform supervisor.",
      };
    }

    // 4. Update last login timestamp asynchronously
    setDoc(
      doc(db, "users", cred.user.uid),
      { lastLoginAt: new Date().toISOString() },
      { merge: true }
    ).catch(() => {});

    return {
      success: true,
      data: {
        user: cred.user,
        profile,
      },
    };
  } catch (err: any) {
    console.error("authenticateAndVerifyUser failure:", err);
    let message = "Authentication failed. Please verify your credentials.";

    if (
      err.code === "auth/invalid-credential" ||
      err.code === "auth/wrong-password" ||
      err.code === "auth/user-not-found"
    ) {
      message = "Invalid email or password. Please try again.";
    } else if (err.code === "auth/too-many-requests") {
      message = "Too many failed attempts. Please try again later or reset your password.";
    } else if (err.message) {
      message = err.message;
    }

    return {
      success: false,
      error: message,
    };
  }
}
