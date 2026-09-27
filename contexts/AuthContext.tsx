"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
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
  updateUserRole as updateRoleInDb,
  toggleUserStatus as toggleStatusInDb,
  deleteUserRecord,
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
  createManager: (data: ManagerCreateInput) => Promise<void>;
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
              // Enforce Single Super Admin Rule: no other email can claim super_admin
              if (data.role === "super_admin" && !isSuperAdminEmail(data.email)) {
                data.role = "admin";
              }
              setUserProfile(data);
            } else {
              // Auto-seed profile for newly detected Firebase Auth user
              const isSuper = isSuperAdminEmail(currentUser.email);
              const initialRole: UserRole = isSuper ? "super_admin" : "user";

              const newProfile: UserProfile = {
                uid: currentUser.uid,
                email: currentUser.email || "",
                displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "User",
                photoURL: currentUser.photoURL || "",
                role: initialRole,
                isActive: true,
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
              };

              try {
                await setDoc(userDocRef, newProfile, { merge: true });
              } catch (err) {
                console.warn("Could not save initial profile to Firestore:", err);
              }
              setUserProfile(newProfile);
            }
            setLoading(false);
          },
          (err) => {
            console.error("Firestore user snapshot error:", err);
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

  const refreshProfile = async () => {
    if (!user) return;
    const profile = await fetchUserProfile(user.uid);
    if (profile) setUserProfile(profile);
  };

  /**
   * Strict async login handler awaiting Firebase Auth & Firestore verification
   */
  const login = async (email: string, pass: string): Promise<UserProfile> => {
    const authResult = await authenticateAndVerifyUser(email, pass);

    if (!authResult.success || !authResult.data) {
      throw new Error(authResult.error || "Failed to sign in. Please verify your credentials.");
    }

    const { user: authedUser, profile } = authResult.data;

    // Update state explicitly before returning
    setUser(authedUser);
    setUserProfile(profile);
    setLoading(false);

    return profile;
  };

  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const profile = await fetchUserProfile(cred.user.uid);
    if (profile && !profile.isActive) {
      await signOut(auth);
      throw new Error("Your account has been deactivated. Please contact an administrator.");
    }
  };

  const register = async (email: string, pass: string, name: string, phone?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    await updateProfile(cred.user, { displayName: name });

    // Strict single super admin check
    const isSuper = isSuperAdminEmail(email.trim());
    const initialRole: UserRole = isSuper ? "super_admin" : "user";

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
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // ignore
    }
    setUser(null);
    setUserProfile(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const createManager = async (data: ManagerCreateInput) => {
    if (!userProfile || (userProfile.role !== "admin" && userProfile.role !== "super_admin")) {
      throw new Error("Unauthorized: Only Admins can create Managers");
    }

    const res = await fetch("/api/admin/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email.trim().toLowerCase(),
        password: data.password || "OsvidManager2026!",
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

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || "Failed to create manager account");
    }

    return result.user;
  };

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    if (!userProfile || (userProfile.role !== "super_admin" && userProfile.role !== "admin")) {
      throw new Error("Unauthorized: Insufficient permissions to change roles");
    }
    await updateRoleInDb(uid, newRole);
  };

  const toggleUserStatus = async (uid: string, isActive: boolean) => {
    if (!userProfile || (userProfile.role !== "super_admin" && userProfile.role !== "admin")) {
      throw new Error("Unauthorized: Insufficient permissions");
    }
    await toggleStatusInDb(uid, isActive);
  };

  const deleteUser = async (uid: string) => {
    if (!userProfile || (userProfile.role !== "super_admin" && userProfile.role !== "admin")) {
      throw new Error("Unauthorized: Insufficient permissions");
    }
    await deleteUserRecord(uid);
  };

  const role: UserRole = userProfile?.role || "user";
  const isSuperAdmin = Boolean(
    role === "super_admin" && isSuperAdminEmail(userProfile?.email)
  );
  const isAdmin = isSuperAdmin || role === "admin";
  const isManager = role === "manager";
  const isStaff = isSuperAdmin || isAdmin || isManager;
  const isCustomer = role === "user";

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
    [user, userProfile, role, loading, isSuperAdmin, isAdmin, isManager, isStaff, isCustomer]
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
