import crypto from "crypto";
import { NextResponse } from "next/server";
import { assertStoreOperationalSubscription } from "@/lib/server/subscription-guard";
import { extractBearerToken, verifyAuthToken } from "@/lib/server/auth";
import {
  createCheckoutSession,
  releaseCheckoutReservationInternal,
  cleanupExpiredCheckoutReservations,
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

    // 2. Best-effort lazy cleanup of expired reservations (Requirement 9)
    cleanupExpiredCheckoutReservations(5).catch((cleanErr) =>
      console.warn("Lazy reservation cleanup notice:", cleanErr)
    );

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

    // 3. Strict Optional Auth Token Semantics (Requirement 21)
    // No Authorization header -> legitimate guest checkout
    // Authorization header present and valid -> authenticated checkout
    // Authorization header present but invalid/expired -> reject with 401
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    let authenticatedUserId: string | undefined = undefined;

    if (authHeader) {
      const token = extractBearerToken(req);
      if (!token) {
        return NextResponse.json(
          { success: false, error: "Malformed Authorization Bearer header." },
          { status: 401 }
        );
      }
      try {
        const verified = await verifyAuthToken(token);
        if (!verified?.uid) {
          return NextResponse.json(
            { success: false, error: "Invalid authentication credentials." },
            { status: 401 }
          );
        }
        authenticatedUserId = verified.uid;
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid, expired, or revoked authentication token." },
          { status: 401 }
        );
      }
    }

    // 4. Create checkout session and reserve stock & coupon in a Firestore transaction
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

    const sessionDocRef = adminDb.collection("checkout_sessions").doc(session.id);

    // 5. If this was an idempotent replay with initialized Paystack state, reuse it (Requirement 4 & 5)
    if (
      replayed &&
      session.paymentInitializationStatus === "initialized" &&
      session.paystackAccessCode &&
      session.paystackReference
    ) {
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
            totalAmountKobo: session.totalAmountKobo,
            currency: "NGN",
          },
          reservationExpiresAtIso: session.reservationExpiresAtIso,
          releaseToken: releaseToken || undefined,
        },
        { status: 200 }
      );
    }

    // 6. Transition session to "initializing" state before external call (Requirement 5)
    await sessionDocRef.update({
      paymentInitializationStatus: "initializing",
      paymentInitializationAttempt: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 7. Initialize Paystack transaction server-side
    const paystackReference =
      session.paystackReference || `osvid_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
    const amountKobo = session.totalAmountKobo;

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

      // Mark session as failed and release reserved units
      await sessionDocRef.update({
        paymentInitializationStatus: "failed",
        updatedAt: FieldValue.serverTimestamp(),
      });
      await releaseCheckoutReservationInternal(session.id, "paystack_init_failed");

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

    // 8. Mark session as initialized in Firestore
    await sessionDocRef.update({
      paymentInitializationStatus: "initialized",
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
          totalAmountKobo: session.totalAmountKobo,
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
