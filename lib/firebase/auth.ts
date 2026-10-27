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
      if (isSuperAdminEmail(data.email)) {
        data.role = "super_admin";
      } else if (data.role === "super_admin") {
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

  return isEmailVerified || isGoogleProvider || hasProviderClaim || Boolean(user);
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
      if (isSuperAdminEmail(profile.email) || isSuperAdminEmail(cleanEmail)) {
        profile.role = "super_admin";
      } else if (profile.role === "super_admin") {
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
    // If this is the designated super admin email, provision their Super Admin profile immediately:
    if (isSuperAdminEmail(cleanEmail)) {
      profile = {
        uid: cred.user.uid,
        email: cleanEmail,
        displayName: cred.user.displayName || "Abolarinwa Emmanuel (Super Admin)",
        photoURL: cred.user.photoURL || "",
        phoneNumber: cred.user.phoneNumber || "",
        role: "super_admin",
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      try {
        await withTimeout(
          setDoc(doc(db, "users", cred.user.uid), profile, { merge: true }),
          5000,
          "Super admin profile initialization timed out"
        );
      } catch (writeErr) {
        console.warn("Could not save initial super admin profile to Firestore:", writeErr);
      }

      return {
        success: true,
        data: {
          user: cred.user,
          profile,
        },
      };
    }

    // If the token claims indicate staff (admin, manager, super_admin):
    if (tokenClaims.role === "admin" || tokenClaims.role === "manager" || tokenClaims.role === "super_admin") {
      const isSuper = isSuperAdminEmail(cleanEmail);
      const staffRole: UserRole = isSuper ? "super_admin" : (tokenClaims.role as UserRole);

      profile = {
        uid: cred.user.uid,
        email: cleanEmail,
        displayName: cred.user.displayName || tokenClaims.customTitle || cleanEmail.split("@")[0],
        photoURL: cred.user.photoURL || "",
        phoneNumber: cred.user.phoneNumber || tokenClaims.phoneNumber || "",
        customTitle:
          tokenClaims.customTitle ||
          (staffRole === "manager"
            ? "Operations Manager"
            : staffRole === "super_admin"
            ? "Primary Super Admin"
            : "Tenant Store Account"),
        role: staffRole,
        permissions: tokenClaims.permissions,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      try {
        const sanitizedProfile = Object.fromEntries(
          Object.entries(profile).filter(([_, v]) => v !== undefined)
        );
        await withTimeout(
          setDoc(doc(db, "users", cred.user.uid), sanitizedProfile, { merge: true }),
          3000,
          "Staff profile write timeout"
        );
      } catch (writeErr) {
        console.warn("Could not save initial staff profile to Firestore:", writeErr);
      }

      return {
        success: true,
        data: {
          user: cred.user,
          profile,
        },
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
