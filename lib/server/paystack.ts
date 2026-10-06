import crypto from "crypto";

export interface PaystackInitParams {
  email: string;
  amountKobo: number;
  reference: string;
  metadata?: Record<string, any>;
  callbackUrl?: string;
}

export interface PaystackInitResult {
  access_code: string;
  reference: string;
  authorization_url?: string;
}

export interface PaystackVerifyResult {
  reference: string;
  status: string;
  amount: number; // in kobo
  currency: string;
  customer: {
    email: string;
    id?: number;
    customer_code?: string;
  };
  metadata?: Record<string, any>;
  paidAt?: string;
  channel?: string;
  raw: any;
}

export interface PaystackRefundParams {
  transactionReference: string;
  amountKobo?: number;
  merchantNote?: string;
}

export interface PaystackRefundResult {
  status: boolean;
  message: string;
  data?: {
    id: number;
    status: string;
    amount: number;
    currency: string;
    transaction: any;
    reference?: string;
    refund_reference?: string;
  };
}

// In-memory injectable HTTP fetch for automated tests without calling external APIs
type PaystackTransport = (url: string, init?: RequestInit) => Promise<Response>;
let testTransport: PaystackTransport | null = null;

export function setPaystackTransportForTesting(transport: PaystackTransport | null) {
  testTransport = transport;
}

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !key.trim()) {
    throw new Error(
      "PAYSTACK_CONFIG_ERROR: PAYSTACK_SECRET_KEY environment variable is not configured."
    );
  }
  return key.trim();
}

async function doFetch(url: string, init?: RequestInit): Promise<Response> {
  if (testTransport) {
    return testTransport(url, init);
  }
  return fetch(url, {
    ...init,
    cache: "no-store",
  });
}

/**
 * Initializes a Paystack transaction server-side.
 * Returns the access_code needed by the client to resume via Popup V2.
 */
export async function initializePaystackTransaction(
  params: PaystackInitParams
): Promise<PaystackInitResult> {
  const secretKey = getSecretKey();

  if (!params.email || !params.reference || !params.amountKobo || params.amountKobo <= 0) {
    throw new Error("Invalid parameters for Paystack transaction initialization.");
  }

  const payload = {
    email: params.email.toLowerCase().trim(),
    amount: params.amountKobo,
    reference: params.reference,
    currency: "NGN",
    metadata: params.metadata || {},
    callback_url: params.callbackUrl,
  };

  const response = await doFetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || !json.status || !json.data?.access_code) {
    const errorMsg =
      json.message || `Paystack initialization failed with HTTP ${response.status}`;
    throw new Error(`Paystack initialization error: ${errorMsg}`);
  }

  return {
    access_code: json.data.access_code,
    reference: json.data.reference || params.reference,
    authorization_url: json.data.authorization_url,
  };
}

/**
 * Verifies a transaction with the Paystack REST API.
 * Confirms status, amount in kobo, and currency.
 */
export async function verifyPaystackTransaction(
  reference: string
): Promise<PaystackVerifyResult> {
  const secretKey = getSecretKey();

  if (!reference || !reference.trim()) {
    throw new Error("Missing transaction reference for Paystack verification.");
  }

  const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference.trim())}`;
  const response = await doFetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      json.message || `Paystack verification returned HTTP ${response.status}`;
    throw new Error(`Paystack verification failed: ${errorMsg}`);
  }

  if (!json.status || !json.data) {
    throw new Error(json.message || "Invalid response format from Paystack verification.");
  }

  const data = json.data;

  return {
    reference: data.reference,
    status: data.status,
    amount: data.amount, // in kobo
    currency: data.currency,
    customer: {
      email: data.customer?.email || "",
      id: data.customer?.id,
      customer_code: data.customer?.customer_code,
    },
    metadata: data.metadata,
    paidAt: data.paid_at,
    channel: data.channel,
    raw: data,
  };
}

/**
 * Initiates a full or partial refund with Paystack.
 */
export async function initiatePaystackRefund(
  params: PaystackRefundParams
): Promise<PaystackRefundResult> {
  const secretKey = getSecretKey();

  if (!params.transactionReference) {
    throw new Error("Missing transaction reference for Paystack refund.");
  }

  const payload: Record<string, any> = {
    transaction: params.transactionReference,
    merchant_note: params.merchantNote || "Order cancellation refund",
  };

  if (params.amountKobo !== undefined && params.amountKobo > 0) {
    payload.amount = params.amountKobo;
  }

  const response = await doFetch("https://api.paystack.co/refund", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      json.message || `Paystack refund returned HTTP ${response.status}`;
    throw new Error(`Paystack refund failed: ${errorMsg}`);
  }

  return {
    status: Boolean(json.status),
    message: json.message || "Refund initiated",
    data: json.data,
  };
}

/**
 * Validates the HMAC SHA512 signature on an incoming Paystack webhook.
 * Uses timingSafeEqual to avoid side-channel timing attacks.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined
): boolean {
  if (!signatureHeader || !rawBody) {
    return false;
  }

  let secretKey: string;
  try {
    secretKey = getSecretKey();
  } catch {
    return false;
  }

  try {
    const computedHmac = crypto
      .createHmac("sha512", secretKey)
      .update(rawBody, "utf8")
      .digest("hex");

    const computedBuffer = Buffer.from(computedHmac, "utf8");
    const receivedBuffer = Buffer.from(signatureHeader.trim(), "utf8");

    if (computedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuffer, receivedBuffer);
  } catch (err) {
    console.error("Error verifying Paystack webhook signature:", err);
    return false;
  }
}
