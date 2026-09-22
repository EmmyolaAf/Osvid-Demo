// components/checkout/ShippingAddressStep.tsx
"use client";

/* eslint-disable  @typescript-eslint/no-explicit-any */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCheckout } from "@/providers/CheckoutProvider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { shippingAddressSchema } from "@/types/checkout.type";
import { nigerianStates } from "@/lib/constants";

export function ShippingAddressStep() {
  const { checkoutData, updateCheckoutData, goToNextStep, goToPrevStep } =
    useCheckout();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(shippingAddressSchema),
    defaultValues: checkoutData.shippingAddress || {
      streetAddress: "",
      city: "",
      state: "",
      country: "Nigeria",
      postalCode: "",
    },
  });

  const onSubmit = async (data: any) => {
    try {
      await updateCheckoutData({ shippingAddress: data });
      goToNextStep();
    } catch (error) {
      toast.error("Failed to save address");
      console.error("Address save error:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Shipping Address</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="streetAddress">Street Address*</Label>
            <Input id="streetAddress" {...register("streetAddress")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City*</Label>
            <Input id="city" {...register("city")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State*</Label>
            <Select
              value={watch("state")}
              onValueChange={(value) => setValue("state", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select State" />
              </SelectTrigger>
              <SelectContent>
                {nigerianStates.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.state && (
              <p className="text-sm text-destructive">{errors.state.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" disabled value="Nigeria" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postalCode">Postal Code</Label>
            <Input id="postalCode" {...register("postalCode")} />
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={goToPrevStep}>
          Back
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </div>
    </form>
  );
}
