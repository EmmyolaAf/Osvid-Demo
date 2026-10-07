import crypto from "crypto";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  verifyPaystackTransaction,
  initiatePaystackRefund,
  PaystackVerifyResult,
  PaystackRefundError,
} from "@/lib/server/paystack";
import {
  validatePaymentReference,
  CommerceValidationError,
  ReservationInvariantError,
} from "@/lib/server/pricing";
import {
  CheckoutSession,
  PaymentTransactionRecord,
  ReceiptEmailStatus,
} from "@/types/commerce";
import { Order, OrderStatus, DiscountCode } from "@/types/auth";
import { generateOrderConfirmationEmail } from "@/lib/email-templates";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export interface FinalizePaymentResult {
  success: boolean;
  orderId?: string;
  amount?: number;
  amountKobo?: number;
  currency?: "NGN";
  replayed: boolean;
  emailSent: boolean;
  anomaly?: boolean;
  message?: string;
}

interface TransactionFinalizationOutcome {
  finalizedNow: boolean;
  replayed: boolean;
  authoritativeOrderId: string;
  anomaly: boolean;
  anomalyReason?: string;
  authoritativeSession?: CheckoutSession;
}

/**
 * Ensures receipt email delivery for finalized payments.
 * Works for both newly finalized payments and idempotent replays (Requirement 7).
 * Atomically claims sending state to prevent duplicate concurrent deliveries and reclaims after 5 minutes.
 */
export async function ensureReceiptEmailForFinalizedPayment(
  cleanRef: string,
  paymentTxRef: FirebaseFirestore.DocumentReference,
  customerEmail: string,
  orderData: {
    orderId: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      variant?: string;
      imageUrl?: string;
    }>;
    total: number;
    subtotal: number;
    shippingFee: number;
    currency: "NGN";
    deliveryMethod: "pickup" | "shipping";
    shippingAddress?: any;
    customerInfo: {
      name: string;
      email: string;
      phone: string;
    };
  },
  paystackRawData?: any
): Promise<boolean> {
  if (!resend || !process.env.FROM_EMAIL) {
    return false;
  }

  const shouldSendEmail = await adminDb.runTransaction(async (transaction) => {
    const txSnap = await transaction.get(paymentTxRef);
    if (!txSnap.exists) return false;
    const tx = txSnap.data() as PaymentTransactionRecord;

    if (tx.receiptEmailStatus === "sent") return false;

    // Allow reclaiming if previous attempt was abandoned > 5 minutes ago or failed
    if (tx.receiptEmailStatus === "sending" && tx.receiptEmailClaimedAt) {
      const claimedMs = new Date(tx.receiptEmailClaimedAt).getTime();
      if (Date.now() - claimedMs < 5 * 60 * 1000) return false;
    }

    transaction.update(paymentTxRef, {
      receiptEmailStatus: "sending" as ReceiptEmailStatus,
      receiptEmailClaimedAt: new Date().toISOString(),
    });
    return true;
  });

  if (!shouldSendEmail) return false;

  try {
    const emailHtml = generateOrderConfirmationEmail({
      reference: cleanRef,
      email: customerEmail,
      orderData,
      paymentData: paystackRawData,
    });

    const emailResponse = await resend.emails.send({
      from: `OSVID CHEMICALS LTD. <${process.env.FROM_EMAIL}>`,
      to: customerEmail,
      bcc: process.env.BCC_EMAIL ? [process.env.BCC_EMAIL] : "osvidbusinesses@gmail.com",
      subject: `Order Confirmation - #${orderData.orderId}`,
      html: emailHtml,
    });

    const emailSent = Boolean(emailResponse?.data);
    if (emailSent) {
      await paymentTxRef.update({
        receiptEmailStatus: "sent" as ReceiptEmailStatus,
        receiptEmailSent: true,
        receiptEmailSentAt: new Date().toISOString(),
      });
      return true;
    } else {
      await paymentTxRef.update({
        receiptEmailStatus: "failed" as ReceiptEmailStatus,
        receiptEmailFailureReason: "Email provider did not return message data.",
      });
      return false;
    }
  } catch (emailErr: any) {
    console.error("Receipt email dispatch failed (order remains finalized):", emailErr);
    await paymentTxRef.update({
      receiptEmailStatus: "failed" as ReceiptEmailStatus,
      receiptEmailFailureReason: emailErr?.message || "Email dispatch failed.",
    });
    return false;
  }
}

/**
 * Shared, authoritative, exactly-once payment finalizer.
 * Both POST /api/payment/verify and POST /api/payment/webhook converge on this exact function.
 */
export async function finalizeSuccessfulPayment(
  reference: string,
  options?: { expectedCheckoutSessionId?: string }
): Promise<FinalizePaymentResult> {
  const cleanRef = validatePaymentReference(reference);

  // 1. Fast-path check: has this payment reference already finalized?
  const paymentTxRef = adminDb.collection("payment_transactions").doc(cleanRef);
  const existingTxSnap = await paymentTxRef.get();

  if (existingTxSnap.exists) {
    const existingTx = existingTxSnap.data() as PaymentTransactionRecord;
    if (existingTx.status === "finalized" && existingTx.orderId) {
      if (options?.expectedCheckoutSessionId) {
        const expectedId = options.expectedCheckoutSessionId.trim();
        if (existingTx.checkoutSessionId !== expectedId) {
          throw new CommerceValidationError(
            `Checkout session binding error: finalized payment "${cleanRef}" belongs to session "${existingTx.checkoutSessionId || ""}", not "${expectedId}".`,
            409
          );
        }
      }

      let emailSent = existingTx.receiptEmailStatus === "sent";
      if (!emailSent) {
        // Attempt receipt retry for finalized payment (Requirement 7)
        const orderSnap = await adminDb.collection("orders").doc(existingTx.orderId).get();
        if (orderSnap.exists) {
          const ord = orderSnap.data() as Order;
          emailSent = await ensureReceiptEmailForFinalizedPayment(
            cleanRef,
            paymentTxRef,
            existingTx.customerEmail || ord.customerEmail,
            {
              orderId: existingTx.orderId,
              items: (ord.items || []).map((it) => ({
                name: it.productName,
                quantity: it.quantity,
                price: it.price,
                variant: it.unit,
                imageUrl: it.imageUrl,
              })),
              total: ord.totalAmount,
              subtotal: ord.subtotal,
              shippingFee: ord.shippingFee,
              currency: "NGN",
              deliveryMethod: ord.deliveryMethod === "pickup" ? "pickup" : "shipping",
              shippingAddress: ord.shippingAddress,
              customerInfo: {
                name: ord.customerName,
                email: ord.customerEmail,
                phone: ord.customerPhone,
              },
            },
            existingTx.paystackData
          );
        }
      }

      return {
        success: true,
        orderId: existingTx.orderId,
        amount: existingTx.amount,
        amountKobo: existingTx.amountKobo,
        currency: (existingTx.currency as "NGN") || "NGN",
        replayed: true,
        emailSent,
      };
    }
    if (existingTx.status === "anomaly_unfulfillable") {
      if (options?.expectedCheckoutSessionId) {
        const expectedId = options.expectedCheckoutSessionId.trim();
        if (existingTx.checkoutSessionId && existingTx.checkoutSessionId !== expectedId) {
          throw new CommerceValidationError(
            `Checkout session binding error: anomaly payment "${cleanRef}" belongs to session "${existingTx.checkoutSessionId}", not "${expectedId}".`,
            409
          );
        }
      }
      return {
        success: false,
        anomaly: true,
        replayed: true,
        emailSent: false,
        message:
          existingTx.anomalyReason ||
          "Payment anomaly: inventory or promotion was unfulfillable. Reconciliation in progress.",
      };
    }
  }

  // 2. Verify payment with Paystack REST API outside Firestore transaction
  const paystackData: PaystackVerifyResult = await verifyPaystackTransaction(cleanRef);

  // Invariant: Paystack transaction status must be success
  if (paystackData.status !== "success") {
    throw new CommerceValidationError(
      `Paystack transaction verification failed: status is "${paystackData.status}".`,
      400
    );
  }

  // Invariant: Paystack reference must exactly equal requested reference
  if (paystackData.reference !== cleanRef) {
    throw new CommerceValidationError(
      `Paystack transaction reference mismatch: gateway returned "${paystackData.reference}", expected "${cleanRef}".`,
      400
    );
  }

  // Invariant: Currency must be NGN
  if (paystackData.currency !== "NGN") {
    throw new CommerceValidationError(
      `Paystack transaction currency mismatch: expected NGN, got "${paystackData.currency}".`,
      400
    );
  }

  // 3. Locate authoritative checkout session with strict binding invariants (Requirement 5)
  let sessionDoc: FirebaseFirestore.DocumentSnapshot | null = null;

  if (options?.expectedCheckoutSessionId) {
    const expectedId = options.expectedCheckoutSessionId.trim();
    const docSnap = await adminDb.collection("checkout_sessions").doc(expectedId).get();

    if (!docSnap.exists) {
      throw new CommerceValidationError(
        `Specified expected checkout session "${expectedId}" does not exist.`,
        404
      );
    }

    const data = docSnap.data() as CheckoutSession;

    // Strict association checks: do NOT fall back to another session if incompatible
    if (data.paystackReference && data.paystackReference !== cleanRef) {
      throw new CommerceValidationError(
        `Checkout session binding error: session "${expectedId}" belongs to reference "${data.paystackReference}", not "${cleanRef}".`,
        409
      );
    }

    if (
      paystackData.metadata?.checkoutSessionId &&
      paystackData.metadata.checkoutSessionId !== expectedId
    ) {
      throw new CommerceValidationError(
        `Paystack metadata session ID "${paystackData.metadata.checkoutSessionId}" does not match requested session "${expectedId}".`,
        409
      );
    }

    sessionDoc = docSnap;
  } else {
    // Lookup by paystackReference
    const qSnap = await adminDb
      .collection("checkout_sessions")
      .where("paystackReference", "==", cleanRef)
      .limit(1)
      .get();

    if (!qSnap.empty) {
      sessionDoc = qSnap.docs[0];
    } else {
      // Special recovery case: Provider init succeeded but updating session failed
      const metaSessionId = paystackData.metadata?.checkoutSessionId;
      if (metaSessionId) {
        const candidateSnap = await adminDb
          .collection("checkout_sessions")
          .doc(metaSessionId)
          .get();

        if (candidateSnap.exists) {
          const candidateData = candidateSnap.data() as CheckoutSession;
          // Allow metadata recovery ONLY if candidate has no conflicting stored reference
          if (!candidateData.paystackReference || candidateData.paystackReference === cleanRef) {
            sessionDoc = candidateSnap;
          } else {
            throw new CommerceValidationError(
              `Conflict: Candidate session "${metaSessionId}" has stored reference "${candidateData.paystackReference}", not "${cleanRef}".`,
              409
            );
          }
        }
      }
    }
  }

  if (!sessionDoc || !sessionDoc.exists) {
    throw new CommerceValidationError(
      `No authoritative checkout session found matching Paystack reference "${cleanRef}".`,
      404
    );
  }

  const session = { id: sessionDoc.id, ...sessionDoc.data() } as CheckoutSession;

  // Requirement 5: Strictly enforce session metadata for all new payments
  if (paystackData.metadata?.clientId !== "osvid") {
    throw new CommerceValidationError(
      "Paystack metadata client identity mismatch: expected clientId 'osvid'.",
      403
    );
  }

  if (paystackData.metadata?.checkoutSessionId !== session.id) {
    throw new CommerceValidationError(
      `Paystack metadata checkoutSessionId mismatch: gateway has "${paystackData.metadata?.checkoutSessionId}", expected "${session.id}".`,
      409
    );
  }

  if (session.paystackReference && session.paystackReference !== cleanRef) {
    throw new CommerceValidationError(
      `Checkout session binding error: session belongs to reference "${session.paystackReference}", not "${cleanRef}".`,
      409
    );
  }

  // Invariant: Exact integer kobo match
  const expectedKobo = session.totalAmountKobo || Math.round(session.totalAmount * 100);
  if (paystackData.amount !== expectedKobo) {
    throw new CommerceValidationError(
      `Authoritative amount mismatch: Paystack charged ${paystackData.amount} kobo, but session total is ${expectedKobo} kobo.`,
      400
    );
  }

  // Invariant: Normalized customer email match
  if (paystackData.customer?.email) {
    const paystackEmail = paystackData.customer.email.toLowerCase().trim();
    const sessionEmail = session.customerEmail.toLowerCase().trim();
    if (paystackEmail !== sessionEmail) {
      throw new CommerceValidationError(
        `Customer email mismatch: Paystack charged "${paystackEmail}", but session belongs to "${sessionEmail}".`,
        400
      );
    }
  }

  const sessionDocRef = adminDb.collection("checkout_sessions").doc(session.id);
  const nowIso = new Date().toISOString();

  // Deterministic order ID derived stably from checkout reference
  const resolvedOrderId =
    session.orderId || `ORD-${cleanRef.replace(/^osvid_/, "").toUpperCase()}`;
  const orderDocRef = adminDb.collection("orders").doc(resolvedOrderId);

  // 4. Atomic Firestore Transaction for business finalization (Requirement 10 & 11)
  const outcome: TransactionFinalizationOutcome = await adminDb.runTransaction(
    async (transaction) => {
      // Re-read payment transaction record inside transaction
      const txSnap = await transaction.get(paymentTxRef);
      if (txSnap.exists) {
        const txData = txSnap.data() as PaymentTransactionRecord;
        if (txData.status === "finalized") {
          return {
            finalizedNow: false,
            replayed: true,
            authoritativeOrderId: txData.orderId || resolvedOrderId,
            anomaly: false,
          };
        }
        if (txData.status === "anomaly_unfulfillable") {
          return {
            finalizedNow: false,
            replayed: true,
            authoritativeOrderId: "",
            anomaly: true,
            anomalyReason: txData.anomalyReason,
          };
        }
      }

      const currentSessionSnap = await transaction.get(sessionDocRef);
      if (!currentSessionSnap.exists) {
        throw new Error("Checkout session disappeared during finalization.");
      }
      const currentSession = {
        id: currentSessionSnap.id,
        ...currentSessionSnap.data(),
      } as CheckoutSession;

      // Requirement 6: Recheck immutable session state inside transaction against verified snapshot
      if (currentSession.id !== session.id) {
        throw new Error(
          `Checkout session ID mismatch during transaction: "${currentSession.id}" vs "${session.id}".`
        );
      }
      const currentExpectedKobo =
        currentSession.totalAmountKobo || Math.round(currentSession.totalAmount * 100);
      if (currentExpectedKobo !== expectedKobo || paystackData.amount !== currentExpectedKobo) {
        throw new Error(
          `Authoritative amount changed during finalization: session=${currentExpectedKobo}, paystack=${paystackData.amount}.`
        );
      }
      if (currentSession.currency !== "NGN") {
        throw new Error(
          `Checkout session currency changed during finalization: "${currentSession.currency}".`
        );
      }
      if (
        currentSession.customerEmail.toLowerCase().trim() !==
        session.customerEmail.toLowerCase().trim()
      ) {
        throw new Error("Customer email modified during checkout finalization.");
      }
      if (currentSession.paystackReference && currentSession.paystackReference !== cleanRef) {
        throw new Error(
          `Checkout session reference changed during transaction: "${currentSession.paystackReference}" vs "${cleanRef}".`
        );
      }
      if (
        !Array.isArray(currentSession.items) ||
        currentSession.items.length !== session.items.length
      ) {
        throw new Error("Checkout session items modified during finalization.");
      }
      for (let i = 0; i < currentSession.items.length; i++) {
        const ci = currentSession.items[i];
        const si = session.items[i];
        if (
          ci.productId !== si.productId ||
          ci.quantity !== si.quantity ||
          ci.unitPrice !== si.unitPrice
        ) {
          throw new Error(`Checkout session item at index ${i} modified during finalization.`);
        }
      }

      // Requirement 4: Read ALL products transactionally before any writes
      const productDocs: Array<{
        ref: FirebaseFirestore.DocumentReference;
        data: FirebaseFirestore.DocumentData;
        item: (typeof currentSession.items)[0];
      }> = [];

      for (const item of currentSession.items) {
        const pRef = adminDb.collection("products").doc(item.productId);
        const pSnap = await transaction.get(pRef);
        if (!pSnap.exists) {
          throw new Error(`Product ${item.productId} not found during finalization.`);
        }
        productDocs.push({
          ref: pRef,
          data: pSnap.data() || {},
          item,
        });
      }

      // Read coupon doc if applicable
      let discountDocRef: FirebaseFirestore.DocumentReference | null = null;
      let discountData: DiscountCode | null = null;
      let couponDisappeared = false;
      if (currentSession.couponId) {
        discountDocRef = adminDb.collection("discounts").doc(currentSession.couponId);
        const dSnap = await transaction.get(discountDocRef);
        if (dSnap.exists) {
          discountData = dSnap.data() as DiscountCode;
        } else {
          couponDisappeared = true;
        }
      }

      // Read customer profile if authenticated (Packet 4D Requirement 1: fix inverted check)
      let userDocRef: FirebaseFirestore.DocumentReference | null = null;
      if (currentSession.authenticatedUserId) {
        const candidateUserRef = adminDb.collection("users").doc(currentSession.authenticatedUserId);
        const uSnap = await transaction.get(candidateUserRef);
        if (uSnap.exists) {
          userDocRef = candidateUserRef;
        } else {
          userDocRef = null;
        }
      }

      // ALL READS ARE NOW COMPLETE. VALIDATE INVARIANTS BEFORE ANY WRITES.

      // Packet 4E Requirement 1: Release active product reservations when coupon disappears
      if (couponDisappeared) {
        const isReservationActive = Boolean(currentSession.reservationActive);
        const anomalyReason = `Coupon "${currentSession.couponCode || currentSession.couponId}" disappeared before payment finalization. Cannot complete redemption bookkeeping.`;

        if (isReservationActive) {
          // 1. All product documents have already been transactionally read.
          // 2. Validate for every item: product.reservedQuantity >= item.quantity
          for (const p of productDocs) {
            const currentReserved = Number(p.data.reservedQuantity || 0);
            if (currentReserved < p.item.quantity) {
              throw new ReservationInvariantError(
                `Reservation invariant violated during coupon anomaly release: product ${p.item.productId} reservedQuantity (${currentReserved}) is less than required (${p.item.quantity}).`
              );
            }
          }

          // 3. Decrement reservedQuantity -= item.quantity for every reserved product (stockQuantity NOT decremented)
          for (const p of productDocs) {
            const currentReserved = Number(p.data.reservedQuantity || 0);
            transaction.update(p.ref, {
              reservedQuantity: currentReserved - p.item.quantity,
              updatedAt: nowIso,
            });
          }
        }

        // 4. Update checkout session: status = "anomaly_unfulfillable", reservationActive = false, releaseReason
        transaction.update(sessionDocRef, {
          status: "anomaly_unfulfillable",
          reservationActive: false,
          releaseReason: "coupon_missing_at_payment_finalization",
          anomalyReason,
          releasedAt: FieldValue.serverTimestamp(),
          releasedAtIso: nowIso,
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtIso: nowIso,
        });

        // 5. Create/update the payment_transactions anomaly record
        transaction.set(paymentTxRef, {
          id: cleanRef,
          reference: cleanRef,
          checkoutSessionId: currentSession.id,
          status: "anomaly_unfulfillable",
          amount: currentSession.totalAmount,
          amountKobo: paystackData.amount,
          currency: "NGN",
          customerEmail: currentSession.customerEmail,
          paystackData: paystackData.raw,
          anomalyReason,
          needsRefund: true,
          refundStatus: "none",
          createdAt: FieldValue.serverTimestamp(),
          createdAtIso: nowIso,
        });

        return {
          finalizedNow: false,
          replayed: false,
          authoritativeOrderId: "",
          anomaly: true,
          anomalyReason,
        };
      }

      const isReservationActive = Boolean(currentSession.reservationActive);

      if (isReservationActive) {
        // Requirement 3: Fail closed on reservation accounting inconsistency
        for (const p of productDocs) {
          const currentStock = Number(p.data.stockQuantity || 0);
          const currentReserved = Number(p.data.reservedQuantity || 0);

          if (currentReserved < p.item.quantity) {
            throw new ReservationInvariantError(
              `Reservation invariant violated: product ${p.item.productId} reservedQuantity (${currentReserved}) is less than required (${p.item.quantity}).`
            );
          }

          const newReserved = currentReserved - p.item.quantity;
          const newStock = currentStock - p.item.quantity;

          if (newStock < 0) {
            throw new Error(
              `Negative stock invariant violated for product "${p.item.name}". Current stock: ${currentStock}, purchase qty: ${p.item.quantity}`
            );
          }

          transaction.update(p.ref, {
            stockQuantity: newStock,
            reservedQuantity: newReserved,
            updatedAt: nowIso,
          });
        }

        // Convert coupon reservation
        if (discountDocRef && discountData) {
          const curUsage = Number(discountData.usageCount || 0);
          const curReservedUsage = Number(discountData.reservedUsageCount || 0);

          if (curReservedUsage < 1) {
            throw new ReservationInvariantError(
              `Reservation invariant violated: coupon ${
                currentSession.couponCode || currentSession.couponId
              } reservedUsageCount (${curReservedUsage}) is less than 1.`
            );
          }

          transaction.update(discountDocRef, {
            usageCount: curUsage + 1,
            reservedUsageCount: curReservedUsage - 1,
          });
        }
      } else {
        // Late payment after reservation expired/released (Requirement 13)
        // 1. Check stock availability
        let hasSufficientStock = true;
        for (const p of productDocs) {
          const currentStock = Number(p.data.stockQuantity || 0);
          const currentReserved = Number(p.data.reservedQuantity || 0);
          const available = currentStock - currentReserved;
          if (available < p.item.quantity) {
            hasSufficientStock = false;
            break;
          }
        }

        // 2. Check coupon capacity on late payment
        let hasCouponCapacity = true;
        if (discountDocRef && discountData) {
          if (discountData.maxUsageLimit !== undefined && discountData.maxUsageLimit !== null) {
            const totalUsage =
              Number(discountData.usageCount || 0) + Number(discountData.reservedUsageCount || 0);
            if (totalUsage >= discountData.maxUsageLimit) {
              hasCouponCapacity = false;
            }
          }
        }

        if (!hasSufficientStock || !hasCouponCapacity) {
          const anomalyReason = !hasSufficientStock
            ? "Late payment after stock reservation expired: product inventory is no longer available."
            : "Late payment after coupon reservation expired: promotion redemption limit has been reached.";

          transaction.update(sessionDocRef, {
            status: "anomaly_unfulfillable",
            anomalyReason,
            updatedAt: FieldValue.serverTimestamp(),
            updatedAtIso: nowIso,
          });

          transaction.set(paymentTxRef, {
            id: cleanRef,
            reference: cleanRef,
            checkoutSessionId: currentSession.id,
            status: "anomaly_unfulfillable",
            amount: currentSession.totalAmount,
            amountKobo: paystackData.amount,
            currency: "NGN",
            customerEmail: currentSession.customerEmail,
            paystackData: paystackData.raw,
            anomalyReason,
            needsRefund: true,
            refundStatus: "none",
            createdAt: FieldValue.serverTimestamp(),
            createdAtIso: nowIso,
          });

          return {
            finalizedNow: false,
            replayed: false,
            authoritativeOrderId: "",
            anomaly: true,
            anomalyReason,
          };
        }

        // Re-acquire stock directly
        for (const p of productDocs) {
          const currentStock = Number(p.data.stockQuantity || 0);
          const newStock = currentStock - p.item.quantity;
          transaction.update(p.ref, {
            stockQuantity: newStock,
            updatedAt: nowIso,
          });
        }

        if (discountDocRef && discountData) {
          transaction.update(discountDocRef, {
            usageCount: Number(discountData.usageCount || 0) + 1,
          });
        }
      }

      // Create deterministic sale inventory ledger movements (Section Q)
      for (const p of productDocs) {
        const currentStock = Number(p.data.stockQuantity || 0);
        const newStock = currentStock - p.item.quantity;
        const movementId = `sale_${cleanRef}_${p.item.productId}`;
        const movementRef = adminDb.collection("inventory_movements").doc(movementId);

        transaction.set(movementRef, {
          id: movementId,
          productId: p.item.productId,
          productName: p.item.name,
          sku: p.item.sku || "",
          delta: -p.item.quantity,
          previousStock: currentStock,
          newStock: newStock,
          type: "sale",
          reason: `Order sale: ${resolvedOrderId}`,
          actorUid: "system:commerce",
          actorEmail: "system@osvid.internal",
          actorRole: "system",
          orderId: resolvedOrderId,
          reference: cleanRef,
          requestId: movementId,
          createdAt: FieldValue.serverTimestamp(),
          createdAtIso: nowIso,
        });
      }

      // Create authoritative Order document using currentSession (Requirement 6)
      const orderItems = currentSession.items.map((it, idx) => ({
        id: `item_${idx}_${Date.now()}`,
        productId: it.productId,
        productName: it.name,
        price: it.unitPrice,
        quantity: it.quantity,
        imageUrl: it.imageUrl,
        unit: it.unit,
      }));

      const formattedShippingAddress = currentSession.shippingAddress
        ? {
            fullName: currentSession.shippingAddress.fullName || currentSession.customerName,
            phone: currentSession.shippingAddress.phone || currentSession.customerPhone,
            email: currentSession.shippingAddress.email || currentSession.customerEmail,
            address:
              currentSession.shippingAddress.address ||
              currentSession.shippingAddress.streetAddress ||
              "Customer Address",
            city: currentSession.shippingAddress.city || "Lagos",
            state: currentSession.shippingAddress.state || "Lagos",
            postalCode: currentSession.shippingAddress.postalCode || "",
          }
        : {
            fullName: currentSession.customerName,
            phone: currentSession.customerPhone,
            email: currentSession.customerEmail,
            address: "Customer Address",
            city: "Lagos",
            state: "Lagos",
          };

      const newOrder: Order = {
        id: resolvedOrderId,
        orderNumber: resolvedOrderId,
        userId: currentSession.authenticatedUserId || undefined,
        customerName: currentSession.customerName,
        customerEmail: currentSession.customerEmail.toLowerCase(),
        customerPhone: currentSession.customerPhone,
        deliveryMethod: currentSession.deliveryMethod === "pickup" ? "pickup" : "delivery",
        shippingAddress: formattedShippingAddress,
        items: orderItems,
        subtotal: currentSession.subtotal,
        shippingFee: currentSession.shippingFee,
        discountAmount: currentSession.discountAmount,
        couponCode: currentSession.couponCode,
        totalAmount: currentSession.totalAmount,
        paymentStatus: "paid",
        orderStatus: "pending" as OrderStatus,
        paystackReference: cleanRef,
        refundStatus: "none",
        statusHistory: [
          {
            status: "pending" as OrderStatus,
            updatedAt: nowIso,
            note: `Payment verified via Paystack (Ref: ${cleanRef})`,
            updatedBy: "System (Authoritative Commerce)",
            eventType: "status",
          },
        ],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      transaction.set(orderDocRef, newOrder);

      // Customer metrics: update strictly for authenticated accounts
      if (userDocRef) {
        transaction.update(userDocRef, {
          totalOrders: FieldValue.increment(1),
          totalSpent: FieldValue.increment(currentSession.totalAmount),
          lastOrderDate: nowIso,
        });
      }

      // Mark checkout session finalized
      transaction.update(sessionDocRef, {
        status: "finalized",
        reservationActive: false,
        paystackReference: cleanRef,
        orderId: resolvedOrderId,
        finalizedAt: FieldValue.serverTimestamp(),
        finalizedAtIso: nowIso,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: nowIso,
      });

      // Create payment transaction record
      transaction.set(paymentTxRef, {
        id: cleanRef,
        reference: cleanRef,
        checkoutSessionId: currentSession.id,
        status: "finalized",
        amount: currentSession.totalAmount,
        amountKobo: paystackData.amount,
        currency: "NGN",
        orderId: resolvedOrderId,
        customerEmail: currentSession.customerEmail,
        paystackData: paystackData.raw,
        receiptEmailSent: false,
        receiptEmailStatus: "pending",
        refundStatus: "none",
        createdAt: FieldValue.serverTimestamp(),
        createdAtIso: nowIso,
        finalizedAtIso: nowIso,
      });

      return {
        finalizedNow: true,
        replayed: false,
        authoritativeOrderId: resolvedOrderId,
        anomaly: false,
        authoritativeSession: currentSession,
      };
    }
  );

  // 5. Handle Anomaly Outcome (Requirement 14 & Packet 4D Section 3)
  if (outcome.anomaly) {
    let refundAccepted = false;
    let providerRefundId: string | undefined = undefined;
    let refundReference: string | undefined = undefined;
    let failureReason: string | undefined = undefined;
    let isDefinitiveFailure = false;

    // Transactionally claim anomaly refund initiation lock on payment_transactions/{cleanRef}
    // Only "none" or definitively retryable "failed" can transition to "initiating"
    let claimAcquired = false;
    try {
      claimAcquired = await adminDb.runTransaction(async (transaction) => {
        const txSnap = await transaction.get(paymentTxRef);
        if (!txSnap.exists) {
          return false;
        }
        const txData = txSnap.data() as PaymentTransactionRecord;
        const currentRefundStatus = txData.refundStatus || "none";

        if (currentRefundStatus === "none" || currentRefundStatus === "failed") {
          transaction.update(paymentTxRef, {
            refundStatus: "initiating",
            refundInitiatingAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            updatedAtIso: nowIso,
          });
          return true;
        }
        return false;
      });
    } catch (claimErr) {
      console.error("Anomaly refund initiation claim failed:", claimErr);
      claimAcquired = false;
    }

    if (claimAcquired) {
      try {
        const refundRes = await initiatePaystackRefund({
          transactionReference: cleanRef,
          amountKobo: paystackData.amount,
          merchantNote: outcome.anomalyReason || "Safe refund: order item unfulfillable.",
        });

        if (refundRes.status) {
          refundAccepted = true;
          providerRefundId = refundRes.data?.id ? String(refundRes.data.id) : undefined;
          refundReference =
            refundRes.data?.refund_reference ||
            (refundRes.data?.reference && refundRes.data?.reference !== cleanRef
              ? refundRes.data?.reference
              : undefined);
        } else {
          failureReason = refundRes.message || "Provider declined refund request.";
          isDefinitiveFailure = true;
        }
      } catch (err: any) {
        console.error("Anomaly refund initiation failed:", err);
        failureReason = err?.message || String(err);
        if (err instanceof PaystackRefundError || err?.name === "PaystackRefundError") {
          isDefinitiveFailure = Boolean(err.isDefinitive);
        } else if (err?.isDefinitive !== undefined) {
          isDefinitiveFailure = Boolean(err.isDefinitive);
        } else {
          isDefinitiveFailure = false;
        }
      }

      // Persist durable anomaly refund state on payment transaction conditionally (Packet 4E Requirement 5, 6, 7)
      try {
        await adminDb.runTransaction(async (transaction) => {
          const currentTxSnap = await transaction.get(paymentTxRef);
          if (!currentTxSnap.exists) return;
          const currentTx = currentTxSnap.data() as PaymentTransactionRecord;
          const currentRefundStatus = currentTx.refundStatus || "none";

          // If a refund webhook has already advanced it to pending, processing, processed, or needs_attention,
          // do NOT overwrite the newer state!
          if (currentRefundStatus !== "initiating") {
            const safeMergeUpdate: Record<string, any> = {};
            if (providerRefundId && !currentTx.providerRefundId) {
              safeMergeUpdate.providerRefundId = providerRefundId;
            }
            if (refundReference && !currentTx.refundReference) {
              safeMergeUpdate.refundReference = refundReference;
            }
            if (Object.keys(safeMergeUpdate).length > 0) {
              transaction.update(paymentTxRef, safeMergeUpdate);
            }
            return;
          }

          if (refundAccepted) {
            transaction.update(paymentTxRef, {
              refundStatus: "pending",
              providerRefundId: providerRefundId || null,
              refundReference: refundReference || null,
              refundRequestedAt: nowIso,
              updatedAt: FieldValue.serverTimestamp(),
              updatedAtIso: nowIso,
            });
          } else if (isDefinitiveFailure) {
            transaction.update(paymentTxRef, {
              needsRefund: true,
              refundStatus: "failed",
              refundFailureReason: failureReason || "Refund initiation failed definitively.",
              updatedAt: FieldValue.serverTimestamp(),
              updatedAtIso: nowIso,
            });
          } else {
            // Ambiguous transport failure or 5xx outcome -> needs_attention (DO NOT mark as ordinary failed)
            transaction.update(paymentTxRef, {
              needsRefund: true,
              refundStatus: "needs_attention",
              refundFailureReason: failureReason || "Ambiguous gateway response. Reconciliation required.",
              updatedAt: FieldValue.serverTimestamp(),
              updatedAtIso: nowIso,
            });
          }
        });
      } catch (persistErr) {
        console.error(
          "Critical: Error during post-provider anomaly refund persistence transaction:",
          persistErr
        );
        // Leave the durable initiating state intact for future reconciliation
      }
    }

    return {
      success: false,
      anomaly: true,
      replayed: outcome.replayed,
      emailSent: false,
      message: claimAcquired
        ? refundAccepted
          ? "Stock or promotion unavailable after expired reservation. A safe refund has been initiated."
          : isDefinitiveFailure
            ? "Stock or promotion unavailable after expired reservation. Refund rejected by provider; please contact support."
            : "Stock or promotion unavailable after expired reservation. Payment requires manual reconciliation; please contact support."
        : outcome.anomalyReason ||
          "Payment anomaly: inventory or promotion was unfulfillable. Refund reconciliation in progress.",
    };
  }

  // 6. Idempotent Atomic Receipt Email Claim (Requirement 7)
  const effectiveSession = outcome.authoritativeSession || session;
  let emailSent = false;

  if (outcome.finalizedNow) {
    emailSent = await ensureReceiptEmailForFinalizedPayment(
      cleanRef,
      paymentTxRef,
      effectiveSession.customerEmail,
      {
        orderId: outcome.authoritativeOrderId,
        items: effectiveSession.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          price: it.unitPrice,
          variant: it.unit,
          imageUrl: it.imageUrl,
        })),
        total: effectiveSession.totalAmount,
        subtotal: effectiveSession.subtotal,
        shippingFee: effectiveSession.shippingFee,
        currency: "NGN",
        deliveryMethod: effectiveSession.deliveryMethod === "pickup" ? "pickup" : "shipping",
        shippingAddress: effectiveSession.shippingAddress,
        customerInfo: {
          name: effectiveSession.customerName,
          email: effectiveSession.customerEmail,
          phone: effectiveSession.customerPhone,
        },
      },
      paystackData.raw
    );
  }

  return {
    success: true,
    orderId: outcome.authoritativeOrderId,
    amount: effectiveSession.totalAmount,
    amountKobo:
      effectiveSession.totalAmountKobo || Math.round(effectiveSession.totalAmount * 100),
    currency: "NGN",
    replayed: outcome.replayed,
    emailSent,
  };
}

/**
 * Reconciles Paystack refund.processed webhook event.
 * Reconciles both orders and standalone anomaly payment transactions (Requirement 18).
 */
export async function finalizeProcessedRefund(refundData: any): Promise<{
  success: boolean;
  orderId?: string;
  alreadyProcessed: boolean;
}> {
  const rawTxRef =
    (typeof refundData?.transaction_reference === "string" &&
      refundData.transaction_reference.trim()) ||
    (typeof refundData?.transaction?.reference === "string" &&
      refundData.transaction.reference.trim()) ||
    null;

  let cleanTxRef: string | null = rawTxRef ? validatePaymentReference(rawTxRef) : null;
  const providerRefundId = refundData?.id ? String(refundData.id) : undefined;
  const rawRefundRef = refundData?.refund_reference || refundData?.reference;
  const refundReference =
    typeof rawRefundRef === "string" &&
    rawRefundRef.trim() &&
    rawRefundRef.trim() !== cleanTxRef
      ? rawRefundRef.trim()
      : undefined;

  // Requirement 13: If cleanTxRef is not explicitly in transaction_reference, try finding matching order/tx by providerRefundId or refundReference
  if (!cleanTxRef) {
    if (providerRefundId) {
      const qByProvId = await adminDb
        .collection("orders")
        .where("providerRefundId", "==", providerRefundId)
        .limit(1)
        .get();
      if (!qByProvId.empty) {
        cleanTxRef = qByProvId.docs[0].data().paystackReference || null;
      }
    }
    if (!cleanTxRef && refundReference) {
      const qByRef = await adminDb
        .collection("orders")
        .where("refundReference", "==", refundReference)
        .limit(1)
        .get();
      if (!qByRef.empty) {
        cleanTxRef = qByRef.docs[0].data().paystackReference || null;
      }
    }
    if (!cleanTxRef && providerRefundId) {
      const qTx = await adminDb
        .collection("payment_transactions")
        .where("providerRefundId", "==", providerRefundId)
        .limit(1)
        .get();
      if (!qTx.empty) {
        cleanTxRef = qTx.docs[0].id;
      }
    }
  }

  if (!cleanTxRef) {
    console.warn(
      "refund.processed webhook missing transaction reference and no matching record found:",
      refundData
    );
    return { success: false, alreadyProcessed: false };
  }

  // 1. Look for matching order
  const ordersSnap = await adminDb
    .collection("orders")
    .where("paystackReference", "==", cleanTxRef)
    .limit(1)
    .get();

  if (!ordersSnap.empty) {
    const orderDoc = ordersSnap.docs[0];
    const orderRef = orderDoc.ref;
    const order = { id: orderDoc.id, ...orderDoc.data() } as Order;

    // Idempotency check: if order is already marked refunded, skip restock
    if (order.paymentStatus === "refunded") {
      return { success: true, orderId: order.id, alreadyProcessed: true };
    }

    const nowIso = new Date().toISOString();

    await adminDb.runTransaction(async (transaction) => {
      // 1. Read order
      const currentOrderSnap = await transaction.get(orderRef);
      if (!currentOrderSnap.exists) return;
      const currentOrder = currentOrderSnap.data() as Order;

      if (currentOrder.paymentStatus === "refunded") {
        return;
      }

      // 2. Read ALL product docs before any writes (Requirement 4)
      const productDocs: Array<{
        ref: FirebaseFirestore.DocumentReference;
        data: FirebaseFirestore.DocumentData;
        item: NonNullable<typeof currentOrder.items>[0];
      }> = [];

      for (const item of currentOrder.items || []) {
        if (item.productId) {
          const pRef = adminDb.collection("products").doc(item.productId);
          const pSnap = await transaction.get(pRef);
          if (pSnap.exists) {
            productDocs.push({
              ref: pRef,
              data: pSnap.data() || {},
              item,
            });
          }
        }
      }

      // 3. Read user doc if applicable
      let userRef: FirebaseFirestore.DocumentReference | null = null;
      let userSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (currentOrder.userId) {
        userRef = adminDb.collection("users").doc(currentOrder.userId);
        userSnap = await transaction.get(userRef);
      }

      // 4. Read payment_transaction doc
      const payTxRef = adminDb.collection("payment_transactions").doc(cleanTxRef!);
      const payTxSnap = await transaction.get(payTxRef);

      // ALL READS ARE COMPLETE. ONLY NOW PERFORM WRITES (Requirement 4)

      // Restock each product and create deterministic return ledger movement
      for (const p of productDocs) {
        const currentStock = Number(p.data.stockQuantity || 0);
        const newStock = currentStock + p.item.quantity;

        transaction.update(p.ref, {
          stockQuantity: newStock,
          updatedAt: nowIso,
        });

        const movementId = `return_${cleanTxRef}_${p.item.productId}`;
        const movementRef = adminDb.collection("inventory_movements").doc(movementId);

        transaction.set(movementRef, {
          id: movementId,
          productId: p.item.productId,
          productName: p.item.productName,
          sku: p.data.sku || "",
          delta: p.item.quantity,
          previousStock: currentStock,
          newStock: newStock,
          type: "return",
          reason: `Refund restock for order ${currentOrder.id}`,
          actorUid: "system:commerce",
          actorEmail: "system@osvid.internal",
          actorRole: "system",
          orderId: currentOrder.id,
          reference: cleanTxRef,
          requestId: movementId,
          createdAt: FieldValue.serverTimestamp(),
          createdAtIso: nowIso,
        });
      }

      // Reverse customer metrics if order was from a registered account
      if (userRef && userSnap && userSnap.exists) {
        transaction.update(userRef, {
          totalSpent: FieldValue.increment(-currentOrder.totalAmount),
        });
      }

      const updatedHistory = [
        ...(currentOrder.statusHistory || []),
        {
          status: currentOrder.orderStatus,
          updatedAt: nowIso,
          note: `Payment refunded via Paystack${
            refundReference ? ` (Refund Ref: ${refundReference})` : ""
          }${providerRefundId ? ` (Provider ID: ${providerRefundId})` : ""}`,
          updatedBy: "System (Paystack Webhook)",
          eventType: "status" as const,
        },
      ];

      const orderUpdate: Record<string, any> = {
        paymentStatus: "refunded",
        refundStatus: "processed",
        refundedAt: nowIso,
        statusHistory: updatedHistory,
        updatedAt: nowIso,
      };
      if (refundReference) orderUpdate.refundReference = refundReference;
      if (providerRefundId) orderUpdate.providerRefundId = providerRefundId;

      transaction.update(orderRef, orderUpdate);

      if (payTxSnap.exists) {
        const payTxUpdate: Record<string, any> = {
          status: "refunded",
          refundStatus: "processed",
          needsRefund: false,
          refundedAtIso: nowIso,
        };
        if (refundReference) payTxUpdate.refundReference = refundReference;
        if (providerRefundId) payTxUpdate.providerRefundId = providerRefundId;

        transaction.update(payTxRef, payTxUpdate);
      }
    });

    return { success: true, orderId: order.id, alreadyProcessed: false };
  }

  // 2. Anomaly Refund Reconciliation Without An Order (Requirement 18)
  const payTxRef = adminDb.collection("payment_transactions").doc(cleanTxRef);
  const payTxSnap = await payTxRef.get();

  if (payTxSnap.exists) {
    const payTx = payTxSnap.data() as PaymentTransactionRecord;

    if (payTx.status === "refunded" && payTx.refundStatus === "processed") {
      return { success: true, alreadyProcessed: true };
    }

    const nowIso = new Date().toISOString();
    await payTxRef.update({
      status: "refunded",
      refundStatus: "processed",
      needsRefund: false,
      refundReference: refundReference || null,
      providerRefundId: providerRefundId || null,
      refundedAtIso: nowIso,
    });

    return { success: true, alreadyProcessed: false };
  }

  console.warn(
    "No order or payment_transaction found for refund transaction reference:",
    cleanTxRef
  );
  return { success: false, alreadyProcessed: false };
}

/**
 * Packet 4E Requirement 2, 8, 9:
 * Enforces refund state monotonicity across route handlers and asynchronous webhooks.
 *
 * Terminal states:
 * - 'processed' is terminal: processed -> processed only.
 *
 * Non-terminal state progression:
 * - processing -> processing | processed
 * - pending -> pending | processing | processed
 * - needs_attention -> pending | processing | processed | failed | needs_attention
 * - initiating -> pending | processing | processed | needs_attention | failed | initiating
 * - failed -> initiating (retry) | pending | processing | processed | failed
 * - none -> any valid state
 *
 * Prevents downgrading newer states when webhooks race with route handlers.
 */
export function canAdvanceRefundStatus(
  current: string | undefined | null,
  incoming: string
): boolean {
  const cur = current || "none";
  if (cur === incoming) return true; // idempotent

  switch (cur) {
    case "processed":
      return false; // Terminal

    case "processing":
      return incoming === "processed";

    case "pending":
      return incoming === "processing" || incoming === "processed";

    case "needs_attention":
      // May move forward when authenticated provider evidence establishes pending, processing, processed, or failed
      return (
        incoming === "pending" ||
        incoming === "processing" ||
        incoming === "processed" ||
        incoming === "failed"
      );

    case "initiating":
      return (
        incoming === "pending" ||
        incoming === "processing" ||
        incoming === "processed" ||
        incoming === "needs_attention" ||
        incoming === "failed"
      );

    case "failed":
      return (
        incoming === "initiating" ||
        incoming === "pending" ||
        incoming === "processing" ||
        incoming === "processed"
      );

    case "none":
    default:
      return true;
  }
}

/**
 * Update refund status for intermediate/terminal refund lifecycle events:
 * refund.pending, refund.processing, refund.needs-attention, refund.failed
 */
export async function updateRefundStatus(
  status: "pending" | "processing" | "needs_attention" | "failed",
  refundData: any
): Promise<{ success: boolean; updated: boolean }> {
  const rawTxRef =
    (typeof refundData?.transaction_reference === "string" &&
      refundData.transaction_reference.trim()) ||
    (typeof refundData?.transaction?.reference === "string" &&
      refundData.transaction.reference.trim()) ||
    null;

  let cleanTxRef: string | null = rawTxRef ? validatePaymentReference(rawTxRef) : null;
  const providerRefundId = refundData?.id ? String(refundData.id) : undefined;
  const rawRefundRef = refundData?.refund_reference || refundData?.reference;
  const refundReference =
    typeof rawRefundRef === "string" &&
    rawRefundRef.trim() &&
    rawRefundRef.trim() !== cleanTxRef
      ? rawRefundRef.trim()
      : undefined;

  if (!cleanTxRef && providerRefundId) {
    const qSnap = await adminDb
      .collection("orders")
      .where("providerRefundId", "==", providerRefundId)
      .limit(1)
      .get();
    if (!qSnap.empty) {
      cleanTxRef = qSnap.docs[0].data().paystackReference || null;
    }
  }

  if (!cleanTxRef) {
    console.warn("updateRefundStatus: No transaction reference found in payload:", refundData);
    return { success: false, updated: false };
  }

  const nowIso = new Date().toISOString();
  const failureReason =
    refundData?.status_message ||
    refundData?.message ||
    (status === "failed" ? refundData?.status || "Paystack refund failed" : undefined);

  // Requirement 14: Update order and payment_transactions together using an Admin SDK batch/transaction.
  // Also make repeated identical webhook events idempotent (no duplicate statusHistory).
  const ordersSnap = await adminDb
    .collection("orders")
    .where("paystackReference", "==", cleanTxRef)
    .limit(1)
    .get();

  const payTxRef = adminDb.collection("payment_transactions").doc(cleanTxRef);
  const payTxSnap = await payTxRef.get();

  if (ordersSnap.empty && !payTxSnap.exists) {
    console.warn("updateRefundStatus: No order or payment transaction found for:", cleanTxRef);
    return { success: true, updated: false };
  }

  const batch = adminDb.batch();
  let hasMutation = false;

  if (!ordersSnap.empty) {
    const orderDoc = ordersSnap.docs[0];
    const order = orderDoc.data() as Order;
    const orderRef = orderDoc.ref;

    const currentRefundStatus = order.refundStatus || "none";
    const isOrderTerminal = order.paymentStatus === "refunded" || currentRefundStatus === "processed";

    // Packet 4E Requirement 8 & 9: Monotonicity check
    const canAdvanceOrder = !isOrderTerminal && canAdvanceRefundStatus(currentRefundStatus, status);
    const orderUpdate: Record<string, any> = {};

    if (canAdvanceOrder) {
      orderUpdate.refundStatus = status;
      orderUpdate.updatedAt = nowIso;
      if (failureReason) orderUpdate.refundFailureReason = failureReason;

      const isSameStatus = currentRefundStatus === status;
      if (!isSameStatus) {
        const note = `Refund status updated to "${status}" via Paystack webhook${
          refundReference ? ` (Ref: ${refundReference})` : ""
        }${failureReason ? `: ${failureReason}` : ""}`;

        orderUpdate.statusHistory = [
          ...(order.statusHistory || []),
          {
            status: order.orderStatus,
            updatedAt: nowIso,
            note,
            updatedBy: "System (Paystack Webhook)",
            eventType: "status",
          },
        ];
      }
    }

    // Merge safe missing provider identifiers even if status is not modified
    if (providerRefundId && !order.providerRefundId) {
      orderUpdate.providerRefundId = providerRefundId;
      orderUpdate.updatedAt = nowIso;
    }
    if (refundReference && !order.refundReference) {
      orderUpdate.refundReference = refundReference;
      orderUpdate.updatedAt = nowIso;
    }

    if (Object.keys(orderUpdate).length > 0) {
      batch.update(orderRef, orderUpdate);
      hasMutation = true;
    }
  }

  if (payTxSnap.exists) {
    const payTxData = payTxSnap.data() as PaymentTransactionRecord;
    const currentTxRefundStatus = payTxData.refundStatus || "none";
    const isTxTerminal = payTxData.status === "refunded" || currentTxRefundStatus === "processed";

    // Packet 4E Requirement 8 & 9: Monotonicity check
    const canAdvanceTx = !isTxTerminal && canAdvanceRefundStatus(currentTxRefundStatus, status);
    const txUpdate: Record<string, any> = {};

    if (canAdvanceTx) {
      txUpdate.refundStatus = status;
      txUpdate.updatedAtIso = nowIso;
      if (failureReason) txUpdate.refundFailureReason = failureReason;
      if (status === "failed") txUpdate.needsRefund = true;
    }

    if (providerRefundId && !payTxData.providerRefundId) {
      txUpdate.providerRefundId = providerRefundId;
      txUpdate.updatedAtIso = nowIso;
    }
    if (refundReference && !payTxData.refundReference) {
      txUpdate.refundReference = refundReference;
      txUpdate.updatedAtIso = nowIso;
    }

    if (Object.keys(txUpdate).length > 0) {
      batch.update(payTxRef, txUpdate);
      hasMutation = true;
    }
  }

  if (hasMutation) {
    await batch.commit();
  }

  return { success: true, updated: hasMutation };
}

