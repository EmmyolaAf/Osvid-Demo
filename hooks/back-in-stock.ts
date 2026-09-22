import { wixBrowserClient } from "@/lib/wix-client.browser";
import {
  BackInStockNotificationRequestValues,
  createBackInStockNotificationRequest,
} from "@/wix-api/backInStockNotifications";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCreateBackInStockNotificationRequest() {
  return useMutation({
    mutationFn: (values: BackInStockNotificationRequestValues) =>
      createBackInStockNotificationRequest(wixBrowserClient, values),
    onError(error) {
      console.error(error);
      const code = (error as any)?.details?.applicationError?.code;

      if (code === "BACK_IN_STOCK_NOTIFICATION_REQUEST_ALREADY_EXISTS") {
        toast.error("You are already subscribed to this product.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    },
  });
}
