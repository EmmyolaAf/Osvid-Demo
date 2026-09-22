// components/checkout/CheckoutHeader.tsx
import { CheckoutStep } from "@/types/checkout.type";
import { cn } from "@/lib/utils";
import { CheckoutProgress } from "./CheckoutProgress";

interface CheckoutHeaderProps {
  currentStep: CheckoutStep;
  className?: string;
}

export function CheckoutHeader({
  currentStep,
  className,
}: CheckoutHeaderProps) {
  const getStepDescription = () => {
    switch (currentStep) {
      case 1:
        return "Choose how you want to receive your order";
      case 2:
        return "Provide your contact and delivery details";
      case 3:
        return "Review your order before payment";
      case 4:
        return "Your order has been placed successfully";
      default:
        return "Complete your order in a few simple steps";
    }
  };

  return (
    <div className={cn("mb-6", className)}>
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold tracking-tight">
          {currentStep === 4 ? "Order Confirmed!" : "Secure Checkout"}
        </h1>
        <p className="text-muted-foreground mt-2">{getStepDescription()}</p>
      </div>
      {currentStep !== 4 && <CheckoutProgress currentStep={currentStep} />}
    </div>
  );
}
