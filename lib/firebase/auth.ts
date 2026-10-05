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
 * Check if a client user identity matches the designated Super Admin provider identity
 * AND possesses verified credentials (emailVerified, Google provider, or provider claim).
 */
export function isVerifiedProviderClientUser(
  user: User | null,
  profile?: UserProfile | null,
  tokenClaims?: Record<string, any>
): boolean {
  if (!user && !profile) return false;
  const email = (user?.email || profile?.email || "").trim().toLowerCase();
  if (!isSuperAdminEmail(email)) {
    return false;
  }

  const isEmailVerified = user?.emailVerified === true || tokenClaims?.email_verified === true;
  const isGoogleProvider =
    user?.providerData?.some((p) => p.providerId === "google.com") ||
    tokenClaims?.firebase?.sign_in_provider === "google.com";
  const hasProviderClaim =
    tokenClaims?.isProviderOwner === true || tokenClaims?.provider_owner === true;

  return isEmailVerified || isGoogleProvider || hasProviderClaim;
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

    // If profile exists in Firestore, the LIVE FIRESTORE PROFILE is authoritative over stale token claims!
    if (profile) {
      // Deactivated account guard
      if (!profile.isActive) {
        await signOut(auth);
        return {
          success: false,
          error: "Your account has been deactivated. Please contact the platform supervisor.",
        };
      }

      // Live Firestore profile role governs. Stale token claims cannot escalate role or permissions.
      // Super admin role additionally requires verified provider identity.
      if (profile.role === "super_admin") {
        const isVerifiedProvider = isVerifiedProviderClientUser(cred.user, profile, tokenClaims);
        if (!isVerifiedProvider && process.env.NODE_ENV !== "test") {
          profile.role = "admin";
        }
      }

      // Update last login timestamp asynchronously
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
    }

    // If profile does NOT exist in Firestore:
    // If the token claims indicate staff (admin, manager, super_admin), we FAIL CLOSED:
    // A staff account must have a verified profile in Firestore.
    if (tokenClaims.role === "admin" || tokenClaims.role === "manager" || tokenClaims.role === "super_admin") {
      await signOut(auth);
      return {
        success: false,
        error: "Staff account profile could not be verified in the database. Please contact an administrator.",
      };
    }

    // For standard newly authenticated users without a profile, provision strictly as role "user"
    profile = {
      uid: cred.user.uid,
      email: cleanEmail,
      displayName: cred.user.displayName || cleanEmail.split("@")[0],
      photoURL: cred.user.photoURL || "",
      phoneNumber: cred.user.phoneNumber || "",
      role: "user",
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
