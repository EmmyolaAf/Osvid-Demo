// components/checkout/CheckoutProgress.tsx
"use client";

import { Button } from "@/components/ui/button";
import { useCheckout } from "@/providers/CheckoutProvider";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckoutProgressProps {
  currentStep: number;
  className?: string;
}

const steps = [
  { id: 1, label: "Delivery", mobileLabel: "1. Delivery" },
  { id: 2, label: "Details", mobileLabel: "2. Details" },
  { id: 3, label: "Summary", mobileLabel: "3. Summary" },
  { id: 4, label: "Complete", mobileLabel: "4. Complete" },
];

export function CheckoutProgress({
  currentStep,
  className,
}: CheckoutProgressProps) {
  const { goToStep, validateCurrentStep } = useCheckout();

  const handleStepClick = (step: number) => {
    if (step < currentStep && validateCurrentStep()) {
      goToStep(step);
    }
  };

  return (
    <div className={cn("mb-8", className)}>
      {/* Desktop Version */}
      <div className="hidden md:block relative">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 bg-gray-200">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{
              width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
            }}
          />
        </div>

        <div className="relative flex justify-between">
          {steps.map((step) => {
            const isComplete = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            const showCheck = isComplete && !isCurrent;

            return (
              <Button
                key={step.id}
                variant="ghost"
                onClick={() => handleStepClick(step.id)}
                disabled={step.id >= currentStep}
                className={cn(
                  "flex flex-col items-center bg-background px-2 h-auto",
                  isComplete && "text-primary",
                  isCurrent && "font-bold"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full mb-2",
                    isComplete
                      ? "bg-primary text-white"
                      : isCurrent
                      ? "bg-primary text-white"
                      : "bg-gray-200"
                  )}
                >
                  {showCheck ? <CheckCircle2 className="h-4 w-4" /> : step.id}
                </div>
                <span>{step.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Mobile Version */}
      <div className="md:hidden flex justify-center">
        <div className="inline-flex items-center gap-2 bg-muted p-2 rounded-full">
          {steps.map((step) => (
            <Button
              key={step.id}
              variant="ghost"
              size="sm"
              onClick={() => handleStepClick(step.id)}
              disabled={step.id >= currentStep}
              className={cn(
                "rounded-full",
                step.id === currentStep && "bg-background font-medium"
              )}
            >
              {step.mobileLabel}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
