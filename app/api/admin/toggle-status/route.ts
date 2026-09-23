import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    const { uid, isActive } = await req.json();
    if (!uid) {
      return NextResponse.json({ error: "User UID is required" }, { status: 400 });
    }

    try {
      await adminAuth.updateUser(uid, { disabled: !isActive });
    } catch (e) {
      // ignore
    }

    try {
      await adminDb.collection("users").doc(uid).update({ isActive });
    } catch (e) {
      // ignore
    }

    return NextResponse.json({ success: true, isActive });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
