import crypto from "crypto";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  verifyPaystackTransaction,
  initiatePaystackRefund,
  PaystackVerifyResult,
} from "@/lib/server/paystack";
import { CheckoutSession, PaymentTransactionRecord } from "@/types/commerce";
import { Order, OrderStatus } from "@/types/auth";
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

/**
 * Shared, authoritative, exactly-once payment finalizer.
 * Both POST /api/payment/verify and POST /api/payment/webhook converge on this exact function.
 */
export async function finalizeSuccessfulPayment(
  reference: string,
  options?: { expectedCheckoutSessionId?: string }
): Promise<FinalizePaymentResult> {
  const cleanRef = reference?.trim();
  if (!cleanRef) {
    throw new Error("Missing payment reference for finalization.");
  }

  // 1. Check if payment was already successfully finalized (Idempotency fast-path)
  const paymentTxRef = adminDb.collection("payment_transactions").doc(cleanRef);
  const existingTxSnap = await paymentTxRef.get();

  if (existingTxSnap.exists) {
    const existingTx = existingTxSnap.data() as PaymentTransactionRecord;
    if (existingTx.status === "finalized" && existingTx.orderId) {
      return {
        success: true,
        orderId: existingTx.orderId,
        replayed: true,
        emailSent: existingTx.receiptEmailSent || false,
      };
    }
    if (existingTx.status === "anomaly_unfulfillable") {
      return {
        success: false,
        anomaly: true,
        replayed: true,
        emailSent: false,
        message: existingTx.anomalyReason || "Payment anomaly: stock was unfulfillable.",
      };
    }
  }

  // 2. Verify payment with Paystack REST API outside Firestore transaction
  const paystackData: PaystackVerifyResult = await verifyPaystackTransaction(cleanRef);

  if (paystackData.status !== "success") {
    throw new Error(
      `Paystack transaction verification failed: status is "${paystackData.status}".`
    );
  }

  if (paystackData.currency !== "NGN") {
    throw new Error(
      `Paystack transaction currency mismatch: expected NGN, got "${paystackData.currency}".`
    );
  }

  // 3. Locate the server-authoritative checkout session
  let sessionSnap: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot | null = null;

  if (options?.expectedCheckoutSessionId) {
    const sDoc = await adminDb
      .collection("checkout_sessions")
      .doc(options.expectedCheckoutSessionId)
      .get();
    if (sDoc.exists) {
      sessionSnap = sDoc;
    }
  }

  if (!sessionSnap || !sessionSnap.exists) {
    const qSnap = await adminDb
      .collection("checkout_sessions")
      .where("paystackReference", "==", cleanRef)
      .limit(1)
      .get();

    if (!qSnap.empty) {
      sessionSnap = qSnap.docs[0];
    }
  }

  if (!sessionSnap || !sessionSnap.exists) {
    // Check paystack metadata
    const metaSessionId = paystackData.metadata?.checkoutSessionId;
    if (metaSessionId) {
      const sDoc = await adminDb.collection("checkout_sessions").doc(metaSessionId).get();
      if (sDoc.exists) {
        sessionSnap = sDoc;
      }
    }
  }

  if (!sessionSnap || !sessionSnap.exists) {
    throw new Error(
      `No authoritative checkout session found matching Paystack reference "${cleanRef}".`
    );
  }

  const session = { id: sessionSnap.id, ...sessionSnap.data() } as CheckoutSession;

  // Verify amount matches exactly in integer kobo
  const expectedKobo = Math.round(session.totalAmount * 100);
  if (paystackData.amount !== expectedKobo) {
    throw new Error(
      `Authoritative amount mismatch: Paystack charged ${paystackData.amount} kobo, but session total is ${expectedKobo} kobo.`
    );
  }

  const nowIso = new Date().toISOString();
  const resolvedOrderId =
    session.orderId ||
    `ORD-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const orderDocRef = adminDb.collection("orders").doc(resolvedOrderId);
  const sessionDocRef = adminDb.collection("checkout_sessions").doc(session.id);

  let finalizationAnomaly: { anomaly: true; message: string } | null = null;

  // 4. Atomic Firestore Transaction for business finalization
  await adminDb.runTransaction(async (transaction) => {
    // A. Re-check payment transaction inside transaction
    const txSnap = await transaction.get(paymentTxRef);
    if (txSnap.exists) {
      const txData = txSnap.data() as PaymentTransactionRecord;
      if (txData.status === "finalized") {
        return; // Already finalized by concurrent webhook/client
      }
    }

    const currentSessionSnap = await transaction.get(sessionDocRef);
    if (!currentSessionSnap.exists) {
      throw new Error("Checkout session document disappeared during finalization.");
    }
    const currentSession = currentSessionSnap.data() as CheckoutSession;

    // B. Read all purchased product documents
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

    // C. Read coupon doc if session has couponId
    let discountDocRef: FirebaseFirestore.DocumentReference | null = null;
    let discountData: FirebaseFirestore.DocumentData | null = null;
    if (session.couponId) {
      discountDocRef = adminDb.collection("discounts").doc(session.couponId);
      const dSnap = await transaction.get(discountDocRef);
      if (dSnap.exists) {
        discountData = dSnap.data() || {};
      }
    }

    // D. Read authenticated customer doc if applicable
    let userDocRef: FirebaseFirestore.DocumentReference | null = null;
    if (session.authenticatedUserId) {
      userDocRef = adminDb.collection("users").doc(session.authenticatedUserId);
      const uSnap = await transaction.get(userDocRef);
      if (!uSnap.exists) {
        userDocRef = null; // User doc doesn't exist, proceed as guest
      }
    }

    // E. Evaluate stock reservation state (Section G & Section W)
    const isReservationActive = Boolean(currentSession.reservationActive);

    if (isReservationActive) {
      // Normal path: convert active reservation into physical stock reduction
      for (const p of productDocs) {
        const currentStock = Number(p.data.stockQuantity || 0);
        const currentReserved = Number(p.data.reservedQuantity || 0);
        const newReserved = Math.max(0, currentReserved - p.item.quantity);
        const newStock = currentStock - p.item.quantity;

        if (newStock < 0) {
          throw new Error(
            `Negative stock invariant violated for product "${p.item.name}". Current: ${currentStock}, required: ${p.item.quantity}`
          );
        }

        transaction.update(p.ref, {
          stockQuantity: newStock,
          reservedQuantity: newReserved,
          updatedAt: nowIso,
        });
      }

      // Finalize coupon reservation: increment usageCount, decrement reservedUsageCount
      if (discountDocRef && discountData) {
        const curUsage = Number(discountData.usageCount || 0);
        const curReservedUsage = Number(discountData.reservedUsageCount || 0);
        transaction.update(discountDocRef, {
          usageCount: curUsage + 1,
          reservedUsageCount: Math.max(0, curReservedUsage - 1),
        });
      }
    } else {
      // Late payment after reservation expired/released (Section W):
      // Attempt to transactionally re-acquire required stock
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

      if (!hasSufficientStock) {
        // CANNOT fulfill order. Persist anomaly state and trigger safe refund path.
        const anomalyMsg =
          "Late payment after reservation expired: inventory is no longer available.";
        transaction.update(sessionDocRef, {
          status: "anomaly_unfulfillable",
          anomalyReason: anomalyMsg,
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
          anomalyReason: anomalyMsg,
          needsRefund: true,
          createdAt: FieldValue.serverTimestamp(),
          createdAtIso: nowIso,
        });

        finalizationAnomaly = { anomaly: true, message: anomalyMsg };
        return;
      }

      // Re-acquire available stock directly
      for (const p of productDocs) {
        const currentStock = Number(p.data.stockQuantity || 0);
        const newStock = currentStock - p.item.quantity;
        transaction.update(p.ref, {
          stockQuantity: newStock,
          updatedAt: nowIso,
        });
      }

      if (discountDocRef && discountData) {
        const curUsage = Number(discountData.usageCount || 0);
        transaction.update(discountDocRef, {
          usageCount: curUsage + 1,
        });
      }
    }

    // F. Create deterministic sale inventory movements (Section Q)
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

    // G. Create authoritative Order document (Section R)
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
          address: session.shippingAddress.address || session.shippingAddress.streetAddress || "",
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

    // H. Update authenticated customer metrics (Section S)
    // NEVER update customer metrics by arbitrary email query for guest checkout
    if (userDocRef) {
      transaction.update(userDocRef, {
        totalOrders: FieldValue.increment(1),
        totalSpent: FieldValue.increment(session.totalAmount),
        lastOrderDate: nowIso,
      });
    }

    // I. Mark checkout session finalized
    transaction.update(sessionDocRef, {
      status: "finalized",
      reservationActive: false,
      finalizedAt: FieldValue.serverTimestamp(),
      finalizedAtIso: nowIso,
      orderId: resolvedOrderId,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtIso: nowIso,
    });

    // J. Create payment transaction idempotency record
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
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: nowIso,
      finalizedAtIso: nowIso,
    });
  });

  // Handle anomaly resolution outside transaction (trigger automatic refund if needed)
  if (finalizationAnomaly) {
    try {
      await initiatePaystackRefund({
        transactionReference: cleanRef,
        amountKobo: paystackData.amount,
        merchantNote: "Safe refund: item stock unavailable after late checkout payment.",
      });
    } catch (refundErr) {
      console.error("Failed to automatically initiate Paystack anomaly refund:", refundErr);
    }

    return {
      success: false,
      anomaly: true,
      replayed: false,
      emailSent: false,
      message: (finalizationAnomaly as any).message,
    };
  }

  // 5. Send Transactional Receipt Email via Resend with idempotency (Section AD)
  let emailSuccess = false;
  try {
    const freshTxSnap = await paymentTxRef.get();
    const freshTx = freshTxSnap.data() as PaymentTransactionRecord;

    if (!freshTx?.receiptEmailSent && resend && process.env.FROM_EMAIL) {
      const emailHtml = generateOrderConfirmationEmail({
        reference: cleanRef,
        email: session.customerEmail,
        orderData: {
          orderId: resolvedOrderId,
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
        subject: `Order Confirmation - #${resolvedOrderId}`,
        html: emailHtml,
      });

      emailSuccess = Boolean(emailResponse?.data);
      if (emailSuccess) {
        await paymentTxRef.update({ receiptEmailSent: true });
      }
    } else if (freshTx?.receiptEmailSent) {
      emailSuccess = true;
    }
  } catch (emailErr) {
    console.error("Receipt email dispatch warning (order remains confirmed):", emailErr);
  }

  return {
    success: true,
    orderId: resolvedOrderId,
    replayed: false,
    emailSent: emailSuccess,
  };
}

/**
 * Reconciles Paystack refund.processed webhook event.
 * Atomically restocks inventory, writes return ledger movements, and updates order status.
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

  if (!transactionRef) {
    console.warn("refund.processed webhook missing transaction reference:", refundData);
    return { success: false, alreadyProcessed: false };
  }

  // Find order by paystackReference
  const ordersSnap = await adminDb
    .collection("orders")
    .where("paystackReference", "==", transactionRef)
    .limit(1)
    .get();

  if (ordersSnap.empty) {
    console.warn("No order found matching refund transaction reference:", transactionRef);
    return { success: false, alreadyProcessed: false };
  }

  const orderDoc = ordersSnap.docs[0];
  const orderRef = orderDoc.ref;
  const order = { id: orderDoc.id, ...orderDoc.data() } as Order;

  // Idempotency check: if order is already marked refunded, do not double-restock!
  if (order.paymentStatus === "refunded") {
    return { success: true, orderId: order.id, alreadyProcessed: true };
  }

  const nowIso = new Date().toISOString();
  const refundReference = refundData.refund_reference || refundData.reference || `REF-${Date.now()}`;

  await adminDb.runTransaction(async (transaction) => {
    const currentOrderSnap = await transaction.get(orderRef);
    if (!currentOrderSnap.exists) return;
    const currentOrder = currentOrderSnap.data() as Order;

    if (currentOrder.paymentStatus === "refunded") {
      return; // Already processed concurrently
    }

    // 1. Restock each product and create deterministic return ledger movement
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

          // Immutable return movement in inventory ledger (Section Y)
          const movementId = `return_${refundReference}_${item.productId}`;
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
            reference: refundReference,
            requestId: movementId,
            createdAt: FieldValue.serverTimestamp(),
            createdAtIso: nowIso,
          });
        }
      }
    }

    // 2. Adjust customer metrics if order was from a registered account
    if (currentOrder.userId) {
      const userRef = adminDb.collection("users").doc(currentOrder.userId);
      const userSnap = await transaction.get(userRef);
      if (userSnap.exists) {
        transaction.update(userRef, {
          totalSpent: FieldValue.increment(-currentOrder.totalAmount),
        });
      }
    }

    // 3. Update order document
    const updatedHistory = [
      ...(currentOrder.statusHistory || []),
      {
        status: currentOrder.orderStatus,
        updatedAt: nowIso,
        note: `Payment refunded via Paystack (Refund Ref: ${refundReference})`,
        updatedBy: "System (Paystack Webhook)",
        eventType: "status" as const,
      },
    ];

    transaction.update(orderRef, {
      paymentStatus: "refunded",
      refundStatus: "processed",
      refundReference,
      refundedAt: nowIso,
      statusHistory: updatedHistory,
      updatedAt: nowIso,
    });

    // 4. Update payment_transactions record
    const payTxRef = adminDb.collection("payment_transactions").doc(transactionRef);
    const payTxSnap = await transaction.get(payTxRef);
    if (payTxSnap.exists) {
      transaction.update(payTxRef, {
        status: "refunded",
        refundReference,
        refundedAtIso: nowIso,
      });
    }
  });

  return { success: true, orderId: order.id, alreadyProcessed: false };
}
