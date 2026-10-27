"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import {
  User,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase/client";
import { UserProfile, UserRole, ManagerCreateInput } from "@/types/auth";
import {
  getUserProfile,
} from "@/lib/firebase/firestore";
import {
  PRIMARY_SUPER_ADMIN_EMAIL,
  isSuperAdminEmail,
  fetchUserProfile,
  authenticateAndVerifyUser,
} from "@/lib/firebase/auth";

export { PRIMARY_SUPER_ADMIN_EMAIL, isSuperAdminEmail };

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  isCustomer: boolean;
  login: (email: string, pass: string) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, pass: string, name: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  createManager: (
    data: ManagerCreateInput
  ) => Promise<{ user: UserProfile; temporaryPassword?: string }>;
  updateUserRole: (uid: string, newRole: UserRole) => Promise<void>;
  toggleUserStatus: (uid: string, isActive: boolean) => Promise<void>;
  deleteUser: (uid: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Synchronize live Auth state with Firestore user document
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(db, "users", currentUser.uid);

        unsubscribeSnapshot = onSnapshot(
          userDocRef,
          async (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              // Enforce Single Super Admin Rule:
              if (isSuperAdminEmail(data.email) || isSuperAdminEmail(currentUser.email)) {
                data.role = "super_admin";
              } else if (data.role === "super_admin") {
                data.role = "admin";
              }
              setUserProfile(data);
            } else {
              // Auto-seed profile for newly detected Firebase Auth user.
              const isSuper = isSuperAdminEmail(currentUser.email);
              let initialRole: UserRole = isSuper ? "super_admin" : "user";
              let permissions = undefined;
              let customTitle = undefined;
              let phoneNumber = "";

              try {
                const tokenResult = await currentUser.getIdTokenResult();
                const claims = (tokenResult?.claims as any) || {};
                if (claims.role === "admin" || claims.role === "manager") {
                  initialRole = claims.role;
                  permissions = claims.permissions;
                  customTitle = claims.customTitle;
                  phoneNumber = claims.phoneNumber || "";
                }
              } catch (e) {
                console.warn("Could not read token claims during profile init:", e);
              }

              const newProfile: UserProfile = {
                uid: currentUser.uid,
                email: currentUser.email || "",
                displayName:
                  currentUser.displayName ||
                  customTitle ||
                  currentUser.email?.split("@")[0] ||
                  (isSuper ? "Super Admin" : "User"),
                photoURL: currentUser.photoURL || "",
                phoneNumber: currentUser.phoneNumber || phoneNumber,
                customTitle:
                  customTitle ||
                  (initialRole === "manager"
                    ? "Operations Manager"
                    : initialRole === "admin"
                    ? "Tenant Store Account"
                    : undefined),
                role: initialRole,
                permissions,
                isActive: true,
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
              };

              try {
                const sanitizedProfile = Object.fromEntries(
                  Object.entries(newProfile).filter(([_, v]) => v !== undefined)
                );
                await setDoc(userDocRef, sanitizedProfile, { merge: true });
              } catch (err) {
                console.warn("Could not save initial profile to Firestore:", err);
              }
              setUserProfile(newProfile);
            }
            setLoading(false);
          },
          async (err) => {
            console.error("Firestore user snapshot error:", err);
            try {
              const tokenResult = await currentUser.getIdTokenResult();
              const claims = (tokenResult?.claims as any) || {};
              const isSuper = isSuperAdminEmail(currentUser.email);
              const fallbackRole: UserRole = isSuper ? "super_admin" : (claims.role || "user");

              setUserProfile({
                uid: currentUser.uid,
                email: currentUser.email || "",
                displayName:
                  currentUser.displayName ||
                  claims.customTitle ||
                  currentUser.email?.split("@")[0] ||
                  (isSuper ? "Super Admin" : "User"),
                photoURL: currentUser.photoURL || "",
                phoneNumber: currentUser.phoneNumber || claims.phoneNumber || "",
                customTitle:
                  claims.customTitle ||
                  (fallbackRole === "manager"
                    ? "Operations Manager"
                    : fallbackRole === "admin"
                    ? "Tenant Store Account"
                    : undefined),
                role: fallbackRole,
                permissions: claims.permissions,
                isActive: true,
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
              });
            } catch (claimErr) {
              console.warn("Failed to extract claims on snapshot error:", claimErr);
            }
            setLoading(false);
          }
        );
      } else {
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    const initFallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => {
      clearTimeout(initFallbackTimer);
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const profile = await fetchUserProfile(user.uid);
    if (profile) setUserProfile(profile);
  }, [user]);

  /**
   * Strict async login handler awaiting Firebase Auth & Firestore verification
   */
  const login = useCallback(async (email: string, pass: string): Promise<UserProfile> => {
    const authResult = await authenticateAndVerifyUser(email, pass);

    if (!authResult.success || !authResult.data) {
      throw new Error(authResult.error || "Failed to sign in. Please verify your credentials.");
    }

    const { user: authedUser, profile } = authResult.data;

    if (isSuperAdminEmail(authedUser.email) || isSuperAdminEmail(profile.email)) {
      profile.role = "super_admin";
    }

    // Update state explicitly before returning
    setUser(authedUser);
    setUserProfile(profile);
    setLoading(false);

    return profile;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const profile = await fetchUserProfile(cred.user.uid);
    if (profile && !profile.isActive) {
      await signOut(auth);
      throw new Error("Your account has been deactivated. Please contact an administrator.");
    }
  }, []);

  const register = useCallback(async (email: string, pass: string, name: string, phone?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    await updateProfile(cred.user, { displayName: name });

    // Public registration MUST strictly create customer accounts (role = "user").
    // Administrative and Super Admin credentials can NEVER be acquired through public registration.
    const initialRole: UserRole = "user";

    const newProfile: UserProfile = {
      uid: cred.user.uid,
      email: email.trim().toLowerCase(),
      displayName: name,
      phoneNumber: phone || "",
      photoURL: cred.user.photoURL || "",
      role: initialRole,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    await setDoc(doc(db, "users", cred.user.uid), newProfile, { merge: true });
    setUserProfile(newProfile);
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // ignore
    }
    setUser(null);
    setUserProfile(null);
  }, []);


  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const createManager = useCallback(async (data: ManagerCreateInput) => {
    if (!userProfile || (userProfile.role !== "admin" && userProfile.role !== "super_admin")) {
      throw new Error("Unauthorized: Only Admins can create Managers");
    }

    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("Unauthorized: No active authentication session found");
    }

    const res = await fetch("/api/admin/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: data.email.trim().toLowerCase(),
        password: data.password?.trim() || undefined,
        displayName: data.displayName.trim(),
        phoneNumber: data.phoneNumber || "",
        customTitle: data.customTitle || "Operations Manager",
        role: "manager",
        permissions: {
          canManageProducts: data.permissions?.canManageProducts ?? true,
          canManageOrders: data.permissions?.canManageOrders ?? true,
          canViewFinancials: data.permissions?.canViewFinancials ?? false,
          canManageWebsite: data.permissions?.canManageWebsite ?? false,
          canManageCustomers: data.permissions?.canManageCustomers ?? true,
          canManageDiscounts: data.permissions?.canManageDiscounts ?? false,
        },
      }),
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      throw new Error(result.error || "Failed to create manager account");
    }

    return {
      user: result.user,
      temporaryPassword: result.temporaryPassword,
    };
  }, [userProfile]);

  const updateUserRole = useCallback(async (uid: string, newRole: UserRole) => {
    if (!userProfile || (userProfile.role !== "super_admin" && userProfile.role !== "admin")) {
      throw new Error("Unauthorized: Insufficient permissions to change roles");
    }

    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("Authentication required to update user role");
    }

    const res = await fetch("/api/admin/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uid, role: newRole }),
    });

    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      throw new Error(result.error || "Failed to update user role");
    }
  }, [userProfile]);

  const toggleUserStatus = useCallback(async (uid: string, isActive: boolean) => {
    if (!userProfile || (userProfile.role !== "super_admin" && userProfile.role !== "admin")) {
      throw new Error("Unauthorized: Insufficient permissions");
    }

    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("Authentication required to update user status");
    }

    const res = await fetch("/api/admin/toggle-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uid, isActive }),
    });

    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      throw new Error(result.error || "Failed to update user status");
    }
  }, [userProfile]);

  const deleteUser = useCallback(async (uid: string) => {
    if (!userProfile || (userProfile.role !== "super_admin" && userProfile.role !== "admin")) {
      throw new Error("Unauthorized: Insufficient permissions");
    }

    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("Authentication required to delete user account");
    }

    const res = await fetch("/api/admin/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uid }),
    });

    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      throw new Error(result.error || "Failed to delete user account");
    }
  }, [userProfile]);

  const isSuper = Boolean(
    isSuperAdminEmail(user?.email) ||
    isSuperAdminEmail(userProfile?.email) ||
    (userProfile?.role === "super_admin" && (isSuperAdminEmail(userProfile?.email) || isSuperAdminEmail(user?.email)))
  );
  const role: UserRole = isSuper ? "super_admin" : (userProfile?.role || "user");
  const isSuperAdmin = isSuper;
  const isAdmin = isSuperAdmin || role === "admin";
  const isManager = role === "manager";
  const isStaff = isSuperAdmin || isAdmin || isManager;
  const isCustomer = role === "user" && !isStaff;

  const value = useMemo(
    () => ({
      user,
      userProfile,
      role,
      loading,
      isSuperAdmin,
      isAdmin,
      isManager,
      isStaff,
      isCustomer,
      login,
      loginWithGoogle,
      register,
      logout,
      resetPassword,
      createManager,
      updateUserRole,
      toggleUserStatus,
      deleteUser,
      refreshProfile,
    }),
    [
      user,
      userProfile,
      role,
      loading,
      isSuperAdmin,
      isAdmin,
      isManager,
      isStaff,
      isCustomer,
      login,
      loginWithGoogle,
      register,
      logout,
      resetPassword,
      createManager,
      updateUserRole,
      toggleUserStatus,
      deleteUser,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
