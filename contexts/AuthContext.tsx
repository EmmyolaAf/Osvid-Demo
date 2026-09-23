"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase/client";
import { UserProfile, UserRole, ManagerCreateInput } from "@/types/auth";
import {
  saveUserProfile,
  getUserProfile,
  updateUserRole as updateRoleInDb,
  toggleUserStatus as toggleStatusInDb,
  deleteUserRecord,
} from "@/lib/firebase/firestore";

// Known Super Admin / Owner email list (or fallback for initial setup)
const SUPER_ADMIN_EMAILS = [
  "abolarinwaemmanuelfree@gmail.com",
  "admin@osvidchemicals.com",
  "osvidchemicals@gmail.com",
  "info@osvidchemicals.com",
];

const SUPER_ADMIN_CREDENTIALS = {
  email: "abolarinwaemmanuelfree@gmail.com",
  password: "Abolarinwa31082001",
  displayName: "Abolarinwa Emmanuel",
};

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
  login: (email: string, pass: string) => Promise<void>;
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

  // Sync profile from Firestore whenever Auth state changes
  useEffect(() => {
    // Check for persisted local Super Admin session first
    if (typeof window !== "undefined") {
      try {
        const storedAdmin = localStorage.getItem("osvid_super_admin_session");
        if (storedAdmin) {
          const parsed = JSON.parse(storedAdmin);
          if (parsed && parsed.email === SUPER_ADMIN_CREDENTIALS.email) {
            setUser({
              uid: parsed.uid,
              email: parsed.email,
              displayName: parsed.displayName,
              photoURL: parsed.photoURL || null,
            } as unknown as User);
            setUserProfile(parsed);
            setLoading(false);
          }
        }
      } catch (e) {
        console.error("Failed to load local admin session", e);
      }
    }

    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Listen to realtime updates on user document in Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        unsubscribeSnapshot = onSnapshot(
          userDocRef,
          async (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              setUserProfile(data);
            } else {
              // Auto-create initial profile for the signed in user
              const isDefaultSuper =
                currentUser.email && SUPER_ADMIN_EMAILS.includes(currentUser.email.toLowerCase());
              const initialRole: UserRole = isDefaultSuper ? "super_admin" : "user";

              const newProfile: UserProfile = {
                uid: currentUser.uid,
                email: currentUser.email || "",
                displayName:
                  currentUser.displayName || currentUser.email?.split("@")[0] || "User",
                photoURL: currentUser.photoURL || "",
                role: initialRole,
                isActive: true,
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
              };

              try {
                await setDoc(userDocRef, newProfile);
              } catch (err) {
                console.warn("Could not write initial profile to Firestore:", err);
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
        // Only clear if not in persisted local Super Admin session
        if (typeof window !== "undefined" && !localStorage.getItem("osvid_super_admin_session")) {
          setUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    const profile = await getUserProfile(user.uid);
    if (profile) setUserProfile(profile);
  };

  const login = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    
    // Check if logging in with the predefined Super Admin credentials
    if (
      cleanEmail === SUPER_ADMIN_CREDENTIALS.email.toLowerCase() &&
      pass === SUPER_ADMIN_CREDENTIALS.password
    ) {
      const superAdminProfile: UserProfile = {
        uid: "super_admin_abolarinwa",
        email: cleanEmail,
        displayName: SUPER_ADMIN_CREDENTIALS.displayName,
        role: "super_admin",
        isActive: true,
        createdAt: "2026-09-23T00:00:00.000Z",
        lastLoginAt: new Date().toISOString(),
      };

      const mockSuperAdminUser = {
        uid: "super_admin_abolarinwa",
        email: cleanEmail,
        displayName: SUPER_ADMIN_CREDENTIALS.displayName,
        photoURL: null,
      } as unknown as User;

      setUser(mockSuperAdminUser);
      setUserProfile(superAdminProfile);
      
      if (typeof window !== "undefined") {
        localStorage.setItem("osvid_super_admin_session", JSON.stringify(superAdminProfile));
      }

      // Try syncing to Firestore if online
      try {
        await setDoc(doc(db, "users", superAdminProfile.uid), superAdminProfile, { merge: true });
      } catch (e) {
        console.warn("Firestore sync skipped:", e);
      }

      // Also attempt Firebase Auth in background if configured
      try {
        await signInWithEmailAndPassword(auth, cleanEmail, pass);
      } catch (e) {
        // Ignored if Firebase project auth is unconfigured
      }
      return;
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      const profile = await getUserProfile(cred.user.uid);
      if (profile && !profile.isActive) {
        await signOut(auth);
        throw new Error("Your account has been deactivated. Please contact an administrator.");
      }
    } catch (firebaseErr: any) {
      throw firebaseErr;
    }
  };

  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const profile = await getUserProfile(cred.user.uid);
    if (profile && !profile.isActive) {
      await signOut(auth);
      throw new Error("Your account has been deactivated. Please contact an administrator.");
    }
  };

  const register = async (email: string, pass: string, name: string, phone?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    await updateProfile(cred.user, { displayName: name });

    const isDefaultSuper = SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
    const initialRole: UserRole = isDefaultSuper ? "super_admin" : "user";

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

    await setDoc(doc(db, "users", cred.user.uid), newProfile);
    setUserProfile(newProfile);
  };

  const logout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("osvid_super_admin_session");
    }
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

  // Manager Creation (by Admin or Super Admin)
  const createManager = async (data: ManagerCreateInput) => {
    if (!userProfile || (userProfile.role !== "admin" && userProfile.role !== "super_admin")) {
      throw new Error("Unauthorized: Only Admins can create Managers");
    }

    // Create a record in Firestore for manager
    const managerDocRef = doc(db, "users", `mgr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const newManagerProfile: UserProfile = {
      uid: managerDocRef.id,
      email: data.email.trim().toLowerCase(),
      displayName: data.displayName,
      customTitle: data.customTitle || "Operations Manager",
      phoneNumber: data.phoneNumber || "",
      role: "manager",
      permissions: {
        canManageProducts: data.permissions?.canManageProducts ?? true,
        canManageOrders: data.permissions?.canManageOrders ?? true,
        canViewFinancials: data.permissions?.canViewFinancials ?? false,
        canManageWebsite: data.permissions?.canManageWebsite ?? false,
        canManageCustomers: data.permissions?.canManageCustomers ?? true,
        canManageDiscounts: data.permissions?.canManageDiscounts ?? false,
      },
      isActive: true,
      createdBy: userProfile.uid,
      createdAt: new Date().toISOString(),
    };

    await setDoc(managerDocRef, newManagerProfile);
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
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "super_admin" || role === "admin";
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
