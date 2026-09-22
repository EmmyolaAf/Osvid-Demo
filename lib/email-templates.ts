// lib/utils/email-templates.ts

/* eslint-disable  @typescript-eslint/no-explicit-any */

import { PaymentVerificationRequest } from "@/types/order-types";

export const generateOrderConfirmationEmail = (
  params: PaymentVerificationRequest & { paymentData: any }
): string => {
  const { reference, orderData, paymentData } = params;

  const escapeHtml = (str: string = "") =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatCurrency = (amount: number, currency: string = "NGN") => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://osvidcompany.vercel.app/_next/image?url=%2Fimages%2Flogo.webp&w=256&q=75" alt="Company Logo" style="max-width: 150px;" />
      </div>

      <!-- Greeting -->
      <h2 style="color: #1a73e8;">Order Confirmation</h2>
      <p>Dear ${
        escapeHtml(orderData?.customerInfo?.name) || "Valued Customer"
      },</p>
      <p>Thank you for your order with Osvid Chemicals Ltd.!</p>

      <!-- Order Summary -->
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1a73e8;">Order Summary</h3>
        <p><strong>Order Reference:</strong> ${escapeHtml(reference)}</p>
        ${
          orderData?.orderId
            ? `<p><strong>Order ID:</strong> ${escapeHtml(
                orderData.orderId
              )}</p>`
            : ""
        }

        ${
          orderData?.items?.length
            ? `
          <h4 style="margin-bottom: 10px;">Items Ordered:</h4>
          <table style="width: 100%; border-collapse: collapse;">
            ${orderData.items
              .map(
                (item) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 0;">
                  ${escapeHtml(item.name)} ${
                  item.variant ? `(${escapeHtml(item.variant)})` : ""
                } (x${item.quantity})
                </td>
                <td style="text-align: right; padding: 8px 0;">
                  ${formatCurrency(
                    item.price * item.quantity,
                    orderData.currency
                  )}
                </td>
              </tr>
            `
              )
              .join("")}
          </table>
        `
            : ""
        }

        ${
          orderData
            ? `
          <div style="margin-top: 15px; text-align: right;">
            <p><strong>Subtotal:</strong> ${formatCurrency(
              orderData.subtotal || 0,
              orderData.currency
            )}</p>
           
            <p style="font-weight: bold; font-size: 1.1em;">
              <strong>Total:</strong> ${formatCurrency(
                orderData.total || 0,
                orderData.currency
              )}
            </p>
          </div>
        `
            : ""
        }

        <p style="margin-top: 15px;">
          <strong>Payment Status:</strong> Verified (${formatCurrency(
            paymentData.amount / 100,
            paymentData.currency
          )})
        </p>
      </div>

      <!-- Delivery Information -->
      ${
        orderData?.deliveryMethod === "shipping" && orderData.shippingAddress
          ? `
        <div style="margin: 20px 0;">
          <h4 style="color: #1a73e8;">Shipping Information</h4>
          <p>${Object.values(orderData.shippingAddress)
            .filter(Boolean)
            .join(", ")}</p>
        </div>
        <div style="margin: 20px 0;">
          <h4 style="color: #1a73e8;">Delivery Fee & Estimated Time</h4>
          <p>Our Customer care service will reach out shortly to discuss your delivery fee and the estimated time to recieve your order.</p>
        </div>
      `
          : ""
      }

      ${
        orderData?.deliveryMethod === "pickup" && orderData.pickupLocationId
          ? `
        <div style="margin: 20px 0;">
          <h4 style="color: #1a73e8;">Pickup Information</h4>
          <p>Location: ${escapeHtml(orderData.pickupLocationId)}</p>
          <p>Ready for pickup in 1-2 hours</p>
        </div>
        
      `
          : ""
      }

      <!-- Footer -->
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 0.9em;">
        <p>© ${new Date().getFullYear()} Osvid Chemicals Ltd. All rights reserved.</p>
        <p>41 Lagos/Badagry Expressway, Lagos, Nigeria</p>
      </div>
    </div>
  `;
};
