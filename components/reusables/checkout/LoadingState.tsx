// components/checkout/LoadingState.tsx
import { Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      <div className="text-center">
        <h2 className="text-xl font-semibold">Loading Your Cart</h2>
        <p className="text-muted-foreground">
          Please wait while we prepare your checkout
        </p>
      </div>
    </div>
  );
}
