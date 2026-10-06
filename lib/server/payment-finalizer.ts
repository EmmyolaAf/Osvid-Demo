import crypto from "crypto";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  verifyPaystackTransaction,
  initiatePaystackRefund,
  PaystackVerifyResult,
} from "@/lib/server/paystack";
import {
  validatePaymentReference,
  CommerceValidationError,
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
      return {
        success: true,
        orderId: existingTx.orderId,
        replayed: true,
        emailSent: existingTx.receiptEmailStatus === "sent",
      };
    }
    if (existingTx.status === "anomaly_unfulfillable") {
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

  // Invariant: Metadata clientId must be "osvid" if present
  if (paystackData.metadata?.clientId && paystackData.metadata.clientId !== "osvid") {
    throw new CommerceValidationError(
      "Paystack metadata client identity mismatch.",
      403
    );
  }

  // 3. Locate authoritative checkout session with strict binding invariants (Requirement 1 & 20)
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
      // Special recovery case (Requirement 1): Provider init succeeded but updating session failed
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
      const currentSession = currentSessionSnap.data() as CheckoutSession;

      // Read all products transactionally
      const productDocs: Array<{
        ref: FirebaseFirestore.DocumentReference;
        data: FirebaseFirestore.DocumentData;
        item: (typeof session.items)[0];
      }> = [];

      for (const item of session.items) {
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
      if (session.couponId) {
        discountDocRef = adminDb.collection("discounts").doc(session.couponId);
        const dSnap = await transaction.get(discountDocRef);
        if (dSnap.exists) {
          discountData = dSnap.data() as DiscountCode;
        }
      }

      // Read customer profile if authenticated
      let userDocRef: FirebaseFirestore.DocumentReference | null = null;
      if (session.authenticatedUserId) {
        userDocRef = adminDb.collection("users").doc(session.authenticatedUserId);
        const uSnap = await transaction.get(userDocRef);
        if (!uSnap.exists) {
          userDocRef = null;
        }
      }

      const isReservationActive = Boolean(currentSession.reservationActive);

      if (isReservationActive) {
        // Active reservation path: convert reservations to physical stock deductions
        for (const p of productDocs) {
          const currentStock = Number(p.data.stockQuantity || 0);
          const currentReserved = Number(p.data.reservedQuantity || 0);

          // Invariant check: reservedQuantity must be >= item.quantity (Requirement 10)
          if (currentReserved < p.item.quantity) {
            console.error(
              `INVARIANT VIOLATION: Product ${p.item.productId} current reservedQuantity (${currentReserved}) is less than required (${p.item.quantity}).`
            );
          }

          const newReserved = Math.max(0, currentReserved - p.item.quantity);
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
            console.error(
              `INVARIANT VIOLATION: Coupon ${session.couponCode} reservedUsageCount (${curReservedUsage}) is less than 1.`
            );
          }

          transaction.update(discountDocRef, {
            usageCount: curUsage + 1,
            reservedUsageCount: Math.max(0, curReservedUsage - 1),
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

        // 2. Check coupon capacity on late payment (Requirement 13)
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
            checkoutSessionId: session.id,
            status: "anomaly_unfulfillable",
            amount: session.totalAmount,
            amountKobo: paystackData.amount,
            currency: "NGN",
            customerEmail: session.customerEmail,
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

      // Create authoritative Order document
      const orderItems = session.items.map((it, idx) => ({
        id: `item_${idx}_${Date.now()}`,
        productId: it.productId,
        productName: it.name,
        price: it.unitPrice,
        quantity: it.quantity,
        imageUrl: it.imageUrl,
        unit: it.unit,
      }));

      const formattedShippingAddress = session.shippingAddress
        ? {
            fullName: session.shippingAddress.fullName || session.customerName,
            phone: session.shippingAddress.phone || session.customerPhone,
            email: session.shippingAddress.email || session.customerEmail,
            address:
              session.shippingAddress.address ||
              session.shippingAddress.streetAddress ||
              "Customer Address",
            city: session.shippingAddress.city || "Lagos",
            state: session.shippingAddress.state || "Lagos",
            postalCode: session.shippingAddress.postalCode || "",
          }
        : {
            fullName: session.customerName,
            phone: session.customerPhone,
            email: session.customerEmail,
            address: "Customer Address",
            city: "Lagos",
            state: "Lagos",
          };

      const newOrder: Order = {
        id: resolvedOrderId,
        orderNumber: resolvedOrderId,
        userId: session.authenticatedUserId || undefined,
        customerName: session.customerName,
        customerEmail: session.customerEmail.toLowerCase(),
        customerPhone: session.customerPhone,
        deliveryMethod: session.deliveryMethod === "pickup" ? "pickup" : "delivery",
        shippingAddress: formattedShippingAddress,
        items: orderItems,
        subtotal: session.subtotal,
        shippingFee: session.shippingFee,
        discountAmount: session.discountAmount,
        couponCode: session.couponCode,
        totalAmount: session.totalAmount,
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
          totalSpent: FieldValue.increment(session.totalAmount),
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
        checkoutSessionId: session.id,
        status: "finalized",
        amount: session.totalAmount,
        amountKobo: paystackData.amount,
        currency: "NGN",
        orderId: resolvedOrderId,
        customerEmail: session.customerEmail,
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
      };
    }
  );

  // 5. Handle Anomaly Outcome (Requirement 14)
  if (outcome.anomaly) {
    let refundAccepted = false;
    let providerRefundId: string | undefined = undefined;
    let refundReference: string | undefined = undefined;
    let failureReason: string | undefined = undefined;

    try {
      const refundRes = await initiatePaystackRefund({
        transactionReference: cleanRef,
        amountKobo: paystackData.amount,
        merchantNote: outcome.anomalyReason || "Safe refund: order item unfulfillable.",
      });

      if (refundRes.status) {
        refundAccepted = true;
        providerRefundId = refundRes.data?.id ? String(refundRes.data.id) : undefined;
        refundReference = refundRes.data?.refund_reference || refundRes.data?.reference || undefined;
      } else {
        failureReason = refundRes.message || "Provider declined refund request.";
      }
    } catch (err: any) {
      console.error("Anomaly refund initiation failed:", err);
      failureReason = err?.message || String(err);
    }

    // Persist durable anomaly refund state on payment transaction
    if (refundAccepted) {
      await paymentTxRef.update({
        refundStatus: "pending",
        providerRefundId: providerRefundId || null,
        refundReference: refundReference || null,
        refundRequestedAt: nowIso,
      });
    } else {
      await paymentTxRef.update({
        needsRefund: true,
        refundStatus: "failed",
        refundFailureReason: failureReason || "Refund initiation failed.",
      });
    }

    return {
      success: false,
      anomaly: true,
      replayed: false,
      emailSent: false,
      message: refundAccepted
        ? "Stock or promotion unavailable after expired reservation. A safe refund has been initiated."
        : "Stock or promotion unavailable after expired reservation. Payment requires manual reconciliation; please contact support.",
    };
  }

  // 6. Idempotent Atomic Receipt Email Claim (Requirement 12)
  let emailSent = false;

  if (outcome.finalizedNow && resend && process.env.FROM_EMAIL) {
    const shouldSendEmail = await adminDb.runTransaction(async (transaction) => {
      const txSnap = await transaction.get(paymentTxRef);
      if (!txSnap.exists) return false;
      const tx = txSnap.data() as PaymentTransactionRecord;

      if (tx.receiptEmailStatus === "sent") return false;

      // Allow reclaiming if previous attempt was abandoned > 5 minutes ago
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

    if (shouldSendEmail) {
      try {
        const emailHtml = generateOrderConfirmationEmail({
          reference: cleanRef,
          email: session.customerEmail,
          orderData: {
            orderId: outcome.authoritativeOrderId,
            items: session.items.map((it) => ({
              name: it.name,
              quantity: it.quantity,
              price: it.unitPrice,
              variant: it.unit,
              imageUrl: it.imageUrl,
            })),
            total: session.totalAmount,
            subtotal: session.subtotal,
            shippingFee: session.shippingFee,
            currency: "NGN",
            deliveryMethod: session.deliveryMethod === "pickup" ? "pickup" : "shipping",
            shippingAddress: session.shippingAddress,
            customerInfo: {
              name: session.customerName,
              email: session.customerEmail,
              phone: session.customerPhone,
            },
          },
          paymentData: paystackData.raw,
        });

        const emailResponse = await resend.emails.send({
          from: `OSVID CHEMICALS LTD. <${process.env.FROM_EMAIL}>`,
          to: session.customerEmail,
          bcc: process.env.BCC_EMAIL ? [process.env.BCC_EMAIL] : "osvidbusinesses@gmail.com",
          subject: `Order Confirmation - #${outcome.authoritativeOrderId}`,
          html: emailHtml,
        });

        emailSent = Boolean(emailResponse?.data);
        if (emailSent) {
          await paymentTxRef.update({
            receiptEmailStatus: "sent" as ReceiptEmailStatus,
            receiptEmailSent: true,
            receiptEmailSentAt: new Date().toISOString(),
          });
        } else {
          await paymentTxRef.update({
            receiptEmailStatus: "failed" as ReceiptEmailStatus,
            receiptEmailFailureReason: "Email provider did not return message data.",
          });
        }
      } catch (emailErr: any) {
        console.error("Receipt email dispatch failed (order remains finalized):", emailErr);
        await paymentTxRef.update({
          receiptEmailStatus: "failed" as ReceiptEmailStatus,
          receiptEmailFailureReason: emailErr?.message || "Email dispatch failed.",
        });
      }
    }
  }

  return {
    success: true,
    orderId: outcome.authoritativeOrderId,
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
  const transactionRef =
    refundData?.transaction_reference ||
    refundData?.transaction?.reference ||
    refundData?.reference;

  if (!transactionRef || typeof transactionRef !== "string") {
    console.warn("refund.processed webhook missing transaction reference:", refundData);
    return { success: false, alreadyProcessed: false };
  }

  const cleanTxRef = transactionRef.trim();

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
    const providerRefundRef = refundData.refund_reference || refundData.reference || cleanTxRef;
    const providerRefundId = refundData.id ? String(refundData.id) : undefined;

    await adminDb.runTransaction(async (transaction) => {
      const currentOrderSnap = await transaction.get(orderRef);
      if (!currentOrderSnap.exists) return;
      const currentOrder = currentOrderSnap.data() as Order;

      if (currentOrder.paymentStatus === "refunded") {
        return;
      }

      // Restock each product and create deterministic return ledger movement
      for (const item of currentOrder.items || []) {
        if (item.productId) {
          const pRef = adminDb.collection("products").doc(item.productId);
          const pSnap = await transaction.get(pRef);
          if (pSnap.exists) {
            const pData = pSnap.data() || {};
            const currentStock = Number(pData.stockQuantity || 0);
            const newStock = currentStock + item.quantity;

            transaction.update(pRef, {
              stockQuantity: newStock,
              updatedAt: nowIso,
            });

            const movementId = `return_${cleanTxRef}_${item.productId}`;
            const movementRef = adminDb.collection("inventory_movements").doc(movementId);

            transaction.set(movementRef, {
              id: movementId,
              productId: item.productId,
              productName: item.productName,
              sku: pData.sku || "",
              delta: item.quantity,
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
        }
      }

      // Reverse customer metrics if order was from a registered account
      if (currentOrder.userId) {
        const userRef = adminDb.collection("users").doc(currentOrder.userId);
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists) {
          transaction.update(userRef, {
            totalSpent: FieldValue.increment(-currentOrder.totalAmount),
          });
        }
      }

      const updatedHistory = [
        ...(currentOrder.statusHistory || []),
        {
          status: currentOrder.orderStatus,
          updatedAt: nowIso,
          note: `Payment refunded via Paystack (Provider Ref: ${providerRefundRef})`,
          updatedBy: "System (Paystack Webhook)",
          eventType: "status" as const,
        },
      ];

      transaction.update(orderRef, {
        paymentStatus: "refunded",
        refundStatus: "processed",
        refundReference: providerRefundRef,
        providerRefundId: providerRefundId || null,
        refundedAt: nowIso,
        statusHistory: updatedHistory,
        updatedAt: nowIso,
      });

      const payTxRef = adminDb.collection("payment_transactions").doc(cleanTxRef);
      const payTxSnap = await transaction.get(payTxRef);
      if (payTxSnap.exists) {
        transaction.update(payTxRef, {
          status: "refunded",
          refundStatus: "processed",
          refundReference: providerRefundRef,
          providerRefundId: providerRefundId || null,
          needsRefund: false,
          refundedAtIso: nowIso,
        });
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
      refundReference: refundData.refund_reference || refundData.reference || null,
      providerRefundId: refundData.id ? String(refundData.id) : null,
      refundedAtIso: nowIso,
    });

    return { success: true, alreadyProcessed: false };
  }

  console.warn("No order or payment_transaction found for refund transaction reference:", cleanTxRef);
  return { success: false, alreadyProcessed: false };
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
    refundData?.transaction_reference ||
    refundData?.transaction?.reference ||
    refundData?.reference;

  if (!rawTxRef || typeof rawTxRef !== "string") {
    console.warn("updateRefundStatus: No transaction reference found in payload");
    return { success: false, updated: false };
  }

  const cleanTxRef = validatePaymentReference(rawTxRef);
  const nowIso = new Date().toISOString();
  const providerRefundId = refundData.id ? String(refundData.id) : undefined;
  const refundReference =
    refundData.refund_reference || refundData.reference || undefined;
  const failureReason =
    refundData.status_message ||
    refundData.message ||
    (status === "failed" ? refundData.status || "Paystack refund failed" : undefined);

  let updated = false;

  // 1. Update matching order if found
  const ordersSnap = await adminDb
    .collection("orders")
    .where("paystackReference", "==", cleanTxRef)
    .limit(1)
    .get();

  if (!ordersSnap.empty) {
    const orderDoc = ordersSnap.docs[0];
    const order = orderDoc.data() as Order;
    const orderRef = orderDoc.ref;

    const orderUpdate: Record<string, any> = {
      refundStatus: status,
      updatedAt: nowIso,
    };
    if (providerRefundId) orderUpdate.providerRefundId = providerRefundId;
    if (refundReference) orderUpdate.refundReference = refundReference;
    if (failureReason) orderUpdate.refundFailureReason = failureReason;

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

    await orderRef.update(orderUpdate);
    updated = true;
  }

  // 2. Update matching payment_transaction if found
  const payTxRef = adminDb.collection("payment_transactions").doc(cleanTxRef);
  const payTxSnap = await payTxRef.get();

  if (payTxSnap.exists) {
    const txUpdate: Record<string, any> = {
      refundStatus: status,
      updatedAtIso: nowIso,
    };
    if (providerRefundId) txUpdate.providerRefundId = providerRefundId;
    if (refundReference) txUpdate.refundReference = refundReference;
    if (failureReason) txUpdate.refundFailureReason = failureReason;
    if (status === "failed") txUpdate.needsRefund = true;

    await payTxRef.update(txUpdate);
    updated = true;
  }

  return { success: true, updated };
}

