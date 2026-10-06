import { NextResponse } from "next/server";
import {
  calculateAuthoritativeQuote,
  CommerceValidationError,
} from "@/lib/server/pricing";
import { CheckoutQuoteResponse } from "@/types/commerce";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse<CheckoutQuoteResponse>> {
  try {
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        {
          success: false,
          items: [],
          subtotal: 0,
          shippingFee: 0,
          discountAmount: 0,
          totalAmount: 0,
          totalAmountKobo: 0,
          currency: "NGN",
          error: "Invalid content-type. Expected application/json",
        },
        { status: 415 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          items: [],
          subtotal: 0,
          shippingFee: 0,
          discountAmount: 0,
          totalAmount: 0,
          totalAmountKobo: 0,
          currency: "NGN",
          error: "Malformed JSON payload.",
        },
        { status: 400 }
      );
    }

    const { items, couponCode, deliveryMethod, shippingAddress, pickupLocationId } = body || {};

    const quote = await calculateAuthoritativeQuote({
      rawItems: items,
      couponCode,
      deliveryMethod,
      shippingAddress,
      pickupLocationId,
    });

    return NextResponse.json(
      {
        success: true,
        items: quote.items,
        subtotal: quote.subtotal,
        shippingFee: quote.shippingFee,
        discountAmount: quote.discountAmount,
        totalAmount: quote.totalAmount,
        totalAmountKobo: quote.totalAmountKobo,
        currency: quote.currency,
        coupon: quote.coupon,
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err instanceof CommerceValidationError) {
      return NextResponse.json(
        {
          success: false,
          items: [],
          subtotal: 0,
          shippingFee: 0,
          discountAmount: 0,
          totalAmount: 0,
          totalAmountKobo: 0,
          currency: "NGN",
          error: err.message,
        },
        { status: err.statusCode }
      );
    }

    console.error("Unexpected error in /api/checkout/quote:", err);
    return NextResponse.json(
      {
        success: false,
        items: [],
        subtotal: 0,
        shippingFee: 0,
        discountAmount: 0,
        totalAmount: 0,
        totalAmountKobo: 0,
        currency: "NGN",
        error: "Unable to calculate checkout quote at this time.",
      },
      { status: 500 }
    );
  }
}
