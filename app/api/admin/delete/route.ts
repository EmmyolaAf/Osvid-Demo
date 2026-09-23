import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    const { uid } = await req.json();
    if (!uid) {
      return NextResponse.json({ error: "User UID is required" }, { status: 400 });
    }

    try {
      await adminAuth.deleteUser(uid);
    } catch (e) {
      // ignore
    }

    try {
      await adminDb.collection("users").doc(uid).delete();
    } catch (e) {
      // ignore
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
