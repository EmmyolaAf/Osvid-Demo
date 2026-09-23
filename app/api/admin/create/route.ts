import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, displayName, phoneNumber, businessName } = body;

    if (!email || !displayName) {
      return NextResponse.json(
        { error: "Email and Full Name are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const userPassword = password || "OsvidAdmin2026!";
    const adminName = displayName.trim();

    let uid = `adm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Try creating user in Firebase Auth
    try {
      const userRecord = await adminAuth.createUser({
        email: cleanEmail,
        password: userPassword,
        displayName: adminName,
        emailVerified: true,
      });
      uid = userRecord.uid;
      console.log(`Created live Firebase Auth user for Admin: ${cleanEmail} (UID: ${uid})`);
    } catch (authErr: any) {
      if (authErr.code === "auth/email-already-exists") {
        // User already exists in Auth, fetch and update
        const existing = await adminAuth.getUserByEmail(cleanEmail);
        uid = existing.uid;
        if (password) {
          await adminAuth.updateUser(uid, { password: userPassword, displayName: adminName });
        }
      } else {
        console.warn("Firebase Auth Admin creation warning:", authErr.message);
      }
    }

    // Save/update Firestore profile
    const profileData = {
      uid,
      email: cleanEmail,
      displayName: adminName,
      phoneNumber: phoneNumber || "",
      customTitle: businessName || "Business Administrator",
      role: "admin",
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    try {
      await adminDb.collection("users").doc(uid).set(profileData, { merge: true });
    } catch (dbErr: any) {
      console.warn("Firestore Admin save warning:", dbErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `Administrator "${adminName}" created successfully!`,
      user: profileData,
    });
  } catch (err: any) {
    console.error("API create admin error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create administrator" },
      { status: 500 }
    );
  }
}
