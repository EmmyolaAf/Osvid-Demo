// components/checkout/DeliveryMethodStep.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCheckout } from "@/providers/CheckoutProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Truck, Store } from "lucide-react";
// import { deliveryMethodSchema } from "@/lib/validations/checkout";
// import { DeliveryEstimate } from "./DeliveryEstimate";
import { deliveryMethodSchema } from "@/types/checkout.type";

const deliveryOptions = [
  {
    value: "shipping",
    label: "Delivery",
    description: "Get it delivered to your address",
    icon: Truck,
    estimate: "2-3 business days",
  },
  {
    value: "pickup",
    label: "Pickup",
    description: "Pick up from our locations",
    icon: Store,
    estimate: "Ready in 1 hour",
  },
];

export function DeliveryMethodStep() {
  const { checkoutData, updateCheckoutData, goToNextStep } = useCheckout();

  const form = useForm({
    resolver: zodResolver(deliveryMethodSchema),
    defaultValues: {
      deliveryMethod: checkoutData.deliveryMethod,
      name: checkoutData.contactInfo.name,
      email: checkoutData.contactInfo.email,
      phone: checkoutData.contactInfo.phone,
    },
  });

  const selectedMethod = form.watch("deliveryMethod");

  const onSubmit = form.handleSubmit((data) => {
    updateCheckoutData({
      deliveryMethod: data.deliveryMethod,
      contactInfo: {
        name: data.name,
        email: data.email,
        phone: data.phone,
      },
    });
    goToNextStep();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Contact Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              // error={errors.contactInfo?.includes("Name is required")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              // error={errors.contactInfo?.includes("Email is required")}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              {...form.register("phone")}
              // error={errors.contactInfo?.includes("Phone is required")}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Delivery Method</h3>
        <RadioGroup
          defaultValue={selectedMethod}
          onValueChange={(value) =>
            form.setValue("deliveryMethod", value as "pickup" | "shipping")
          }
          className="grid gap-4 md:grid-cols-2"
        >
          {deliveryOptions.map((option) => (
            <div key={option.value}>
              <RadioGroupItem
                value={option.value}
                id={option.value}
                className="peer sr-only"
              />
              <Label
                htmlFor={option.value}
                className="flex flex-col items-center justify-between rounded-lg border-2 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <div className="flex items-center gap-2">
                  <option.icon className="h-5 w-5" />
                  <span className="font-medium">{option.label}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
                {/* <DeliveryEstimate method={option.value} /> */}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        Continue
      </Button>
    </form>
  );
}
