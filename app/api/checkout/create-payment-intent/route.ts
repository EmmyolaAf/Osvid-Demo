import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

// Optional: You can move this to a separate file like `types/checkout.ts`
const CheckoutSchema = z.object({
  cartId: z.string().min(1, "Cart ID is required"),
  checkoutData: z.object({
    contactInfo: z.object({
      email: z.string().email(),
      name: z.string().optional(),
      phone: z.string().optional(),
    }),
    deliveryMethod: z.enum(["pickup", "shipping"]),
    shippingAddress: z
      .object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        country: z.string(),
      })
      .optional(),
    pickupLocationId: z.string().optional(),
  }),
});

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { cartId, checkoutData } = parsed.data;

    const reference = `order_${uuidv4().replace(/-/g, "").substring(0, 12)}`;

    // Production-only check
    if (!PAYSTACK_SECRET_KEY && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Server misconfiguration. Please try again later." },
        { status: 500 }
      );
    }

    const amount = calculateOrderAmount(checkoutData);

    const payload = {
      email: checkoutData.contactInfo.email,
      amount,
      reference,
      callback_url: `${APP_URL}/order-confirmation`,
      metadata: {
        cart_id: cartId,
        customer_name: checkoutData.contactInfo.name || "",
        customer_phone: checkoutData.contactInfo.phone || "",
        delivery_method: checkoutData.deliveryMethod,
        pickup_location_id:
          checkoutData.deliveryMethod === "pickup"
            ? checkoutData.pickupLocationId || ""
            : null,
        shipping_address:
          checkoutData.deliveryMethod === "shipping"
            ? JSON.stringify(checkoutData.shippingAddress)
            : null,
      },
    };

    let authorization_url = "";

    if (PAYSTACK_SECRET_KEY) {
      const paystackResponse = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!paystackResponse.ok) {
        const errorText = await paystackResponse.text();
        console.error("Paystack API error:", {
          status: paystackResponse.status,
          statusText: paystackResponse.statusText,
          body: errorText,
        });

        return NextResponse.json(
          { error: "Failed to initialize Paystack transaction" },
          { status: 500 }
        );
      }

      const paystackData = await paystackResponse.json();
      authorization_url = paystackData.data.authorization_url;
    }

    // Store order in your DB (mock)
    await storeOrderDetails(reference, cartId, checkoutData);

    return NextResponse.json({
      reference,
      ...(authorization_url && { authorization_url }),
    });
  } catch (error) {
    console.error("Create payment intent error:", error);
    return NextResponse.json(
      { error: "Failed to process payment request" },
      { status: 500 }
    );
  }
}

function calculateOrderAmount(
  checkoutData: z.infer<typeof CheckoutSchema>["checkoutData"]
): number {
  const baseAmount = 10000; // Placeholder: ₦100.00 in kobo
  const shippingFee =
    checkoutData.deliveryMethod === "shipping" ? 1500 * 100 : 0;

  return baseAmount + shippingFee;
}

async function storeOrderDetails(
  reference: string,
  cartId: string,
  checkoutData: z.infer<typeof CheckoutSchema>["checkoutData"]
) {
  console.log("Storing order details:", {
    reference,
    cartId,
    checkoutData,
  });

  // TODO: Save to DB
}
