import crypto from "crypto";
import { NextResponse } from "next/server";
import { assertStoreOperationalSubscription } from "@/lib/server/subscription-guard";
import { extractBearerToken, verifyAuthToken } from "@/lib/server/auth";
import {
  createCheckoutSession,
  releaseCheckoutReservation,
} from "@/lib/server/checkout-session";
import { initializePaystackTransaction } from "@/lib/server/paystack";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { CommerceValidationError } from "@/lib/server/pricing";
import { PaymentInitializeResponse } from "@/types/commerce";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request
): Promise<NextResponse<PaymentInitializeResponse>> {
  try {
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { success: false, error: "Invalid content-type. Expected application/json" },
        { status: 415 }
      );
    }

    // 1. Enforce store operational subscription (fail closed)
    await assertStoreOperationalSubscription();

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Malformed JSON payload." },
        { status: 400 }
      );
    }

    const {
      checkoutRequestId,
      items,
      customerInfo,
      deliveryMethod,
      shippingAddress,
      pickupLocationId,
      couponCode,
    } = body || {};

    if (!checkoutRequestId) {
      return NextResponse.json(
        { success: false, error: "checkoutRequestId is required for idempotency." },
        { status: 400 }
      );
    }

    // 2. Authenticate Firebase user from Authorization Bearer token if provided
    // NEVER trust a browser-provided userId in the request body
    const token = extractBearerToken(req);
    let authenticatedUserId: string | undefined = undefined;
    if (token) {
      try {
        const verified = await verifyAuthToken(token);
        if (verified?.uid) {
          authenticatedUserId = verified.uid;
        }
      } catch (authErr) {
        console.warn("Optional auth token verification failed during checkout:", authErr);
      }
    }

    // 3. Create checkout session and reserve stock & coupon in a Firestore transaction
    const { session, releaseToken, replayed } = await createCheckoutSession({
      checkoutRequestId,
      items,
      customerInfo,
      deliveryMethod: deliveryMethod === "pickup" ? "pickup" : "shipping",
      shippingAddress,
      pickupLocationId,
      couponCode,
      authenticatedUserId,
    });

    // If this was an idempotent replay and Paystack is already initialized, return it
    if (replayed && session.paystackAccessCode && session.paystackReference) {
      return NextResponse.json(
        {
          success: true,
          checkoutSessionId: session.id,
          accessCode: session.paystackAccessCode,
          reference: session.paystackReference,
          totals: {
            subtotal: session.subtotal,
            shippingFee: session.shippingFee,
            discountAmount: session.discountAmount,
            totalAmount: session.totalAmount,
            currency: "NGN",
          },
          reservationExpiresAtIso: session.reservationExpiresAtIso,
          releaseToken: undefined,
        },
        { status: 200 }
      );
    }

    // 4. Generate Paystack reference server-side
    const paystackReference = `osvid_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
    const amountKobo = Math.round(session.totalAmount * 100);

    // 5. Initialize Paystack transaction server-side
    let accessCode = "";
    try {
      const paystackRes = await initializePaystackTransaction({
        email: session.customerEmail,
        amountKobo,
        reference: paystackReference,
        metadata: {
          checkoutSessionId: session.id,
          clientId: "osvid",
          customerName: session.customerName,
          authenticatedUserId: session.authenticatedUserId,
        },
      });

      accessCode = paystackRes.access_code;
    } catch (paystackErr: any) {
      console.error("Paystack initialization failed, releasing reservation:", paystackErr);
      // Immediately release stock and coupon reservation
      await releaseCheckoutReservation(session.id, "paystack_init_failed");

      return NextResponse.json(
        {
          success: false,
          error:
            paystackErr.message?.replace(/PAYSTACK_SECRET_KEY.*/, "Payment provider error.") ||
            "Failed to initialize payment gateway.",
        },
        { status: 502 }
      );
    }

    // 6. Update checkout session with Paystack credentials
    await adminDb.collection("checkout_sessions").doc(session.id).update({
      paystackReference,
      paystackAccessCode: accessCode,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      {
        success: true,
        checkoutSessionId: session.id,
        accessCode,
        reference: paystackReference,
        totals: {
          subtotal: session.subtotal,
          shippingFee: session.shippingFee,
          discountAmount: session.discountAmount,
          totalAmount: session.totalAmount,
          currency: "NGN",
        },
        reservationExpiresAtIso: session.reservationExpiresAtIso,
        releaseToken,
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err instanceof CommerceValidationError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }

    console.error("Critical error in /api/payment/initialize:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error during payment initialization." },
      { status: err?.statusCode || 500 }
    );
  }
}
