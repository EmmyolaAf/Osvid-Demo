import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import {
  requireAuthenticatedUser,
  hasPermission,
  authErrorResponse,
  AuthError,
} from "@/lib/server/auth";
import { assertOperationalSubscription } from "@/lib/server/subscription-guard";
import { InventoryMovement } from "@/types/inventory";

export async function GET(req: NextRequest) {
  try {
    const caller = await requireAuthenticatedUser(req);

    if (
      !caller.isSuperAdmin &&
      !caller.isAdmin &&
      !hasPermission(caller, "canManageInventory")
    ) {
      throw new AuthError(
        "Forbidden: Insufficient privileges to view inventory history.",
        403
      );
    }

    await assertOperationalSubscription(caller);

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);
    const safeLimit = Math.min(Math.max(1, isNaN(limitParam) ? 50 : limitParam), 200);

    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      if (productId && productId.trim().length > 0) {
        snap = await adminDb
          .collection("inventory_movements")
          .where("productId", "==", productId.trim())
          .orderBy("createdAt", "desc")
          .limit(safeLimit)
          .get();
      } else {
        snap = await adminDb
          .collection("inventory_movements")
          .orderBy("createdAt", "desc")
          .limit(safeLimit)
          .get();
      }
    } catch (queryErr: any) {
      if (productId && productId.trim().length > 0) {
        snap = await adminDb
          .collection("inventory_movements")
          .where("productId", "==", productId.trim())
          .limit(safeLimit)
          .get();
      } else {
        throw queryErr;
      }
    }

    const movements: InventoryMovement[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        productId: data.productId,
        productName: data.productName,
        sku: data.sku,
        delta: data.delta,
        previousStock: data.previousStock,
        newStock: data.newStock,
        type: data.type,
        reason: data.reason,
        actorUid: data.actorUid,
        actorEmail: data.actorEmail,
        actorRole: data.actorRole,
        orderId: data.orderId,
        reference: data.reference,
        requestId: data.requestId,
        createdAt: data.createdAt,
        createdAtIso: data.createdAtIso || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
      };
    });

    movements.sort((a, b) => {
      const timeA = new Date(a.createdAtIso || 0).getTime();
      const timeB = new Date(b.createdAtIso || 0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({ success: true, movements });
  } catch (err: any) {
    return authErrorResponse(err);
  }
}
