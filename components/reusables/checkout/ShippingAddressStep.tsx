// components/checkout/ShippingAddressStep.tsx
"use client";

import { useState } from "react";
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
import { shippingAddressSchema, ShippingAddress } from "@/types/checkout.type";
import { nigerianStates } from "@/lib/constants";

export function ShippingAddressStep() {
  const { checkoutData, updateCheckoutData, goToNextStep, goToPrevStep } =
    useCheckout();

  const [sameAsShipping, setSameAsShipping] = useState(
    checkoutData.sameAsShipping !== undefined ? checkoutData.sameAsShipping : true
  );

  const [billingAddress, setBillingAddress] = useState<ShippingAddress>(
    checkoutData.billingAddress || {
      streetAddress: "",
      city: "",
      state: "",
      country: "Nigeria",
      postalCode: "",
    }
  );

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
      const finalBilling = sameAsShipping ? data : billingAddress;
      await updateCheckoutData({
        shippingAddress: data,
        billingAddress: finalBilling,
        sameAsShipping,
      });
      goToNextStep();
    } catch (error) {
      toast.error("Failed to save address");
      console.error("Address save error:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-900">Delivery Address</h3>
        <p className="text-xs text-slate-500">
          Please enter the delivery destination for your industrial chemical order.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="streetAddress" className="text-xs font-bold text-slate-700">
              Street / Facility Address <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="streetAddress"
              {...register("streetAddress")}
              className="rounded-xl h-11 border-slate-200 text-xs"
              placeholder="e.g. Plot 14 Commercial Avenue, Ikeja"
            />
            {errors.streetAddress && (
              <p className="text-xs text-rose-500">{errors.streetAddress.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="city" className="text-xs font-bold text-slate-700">
              City / LGA <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="city"
              {...register("city")}
              className="rounded-xl h-11 border-slate-200 text-xs"
              placeholder="e.g. Ikeja"
            />
            {errors.city && (
              <p className="text-xs text-rose-500">{errors.city.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="state" className="text-xs font-bold text-slate-700">
              State <span className="text-rose-500">*</span>
            </Label>
            <Select
              value={watch("state")}
              onValueChange={(value) => setValue("state", value)}
            >
              <SelectTrigger className="rounded-xl h-11 border-slate-200 text-xs">
                <SelectValue placeholder="Select Nigerian State" />
              </SelectTrigger>
              <SelectContent>
                {nigerianStates.map((state) => (
                  <SelectItem key={state} value={state} className="text-xs">
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.state && (
              <p className="text-xs text-rose-500">{errors.state.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="country" className="text-xs font-bold text-slate-700">Country</Label>
            <Input
              id="country"
              disabled
              value="Nigeria"
              className="rounded-xl h-11 border-slate-200 text-xs bg-slate-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postalCode" className="text-xs font-bold text-slate-700">Postal / Zip Code (Optional)</Label>
            <Input
              id="postalCode"
              {...register("postalCode")}
              className="rounded-xl h-11 border-slate-200 text-xs"
              placeholder="e.g. 100001"
            />
          </div>
        </div>
      </div>

      {/* Billing Address Toggle */}
      <div className="pt-4 border-t border-slate-200 space-y-4">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={sameAsShipping}
            onChange={(e) => setSameAsShipping(e.target.checked)}
            className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
          />
          <span className="text-xs font-bold text-slate-800">
            Billing address is the same as delivery address
          </span>
        </label>

        {!sameAsShipping && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 animate-in fade-in duration-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Billing Address (Invoice Destination)
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs text-slate-600">Street / Company Address</Label>
                <Input
                  value={billingAddress.streetAddress}
                  onChange={(e) =>
                    setBillingAddress({ ...billingAddress, streetAddress: e.target.value })
                  }
                  className="rounded-xl h-10 bg-white text-xs"
                  placeholder="Billing street address"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">City</Label>
                <Input
                  value={billingAddress.city}
                  onChange={(e) =>
                    setBillingAddress({ ...billingAddress, city: e.target.value })
                  }
                  className="rounded-xl h-10 bg-white text-xs"
                  placeholder="City"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">State</Label>
                <Select
                  value={billingAddress.state}
                  onValueChange={(val) =>
                    setBillingAddress({ ...billingAddress, state: val })
                  }
                >
                  <SelectTrigger className="rounded-xl h-10 bg-white text-xs">
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>
                  <SelectContent>
                    {nigerianStates.map((st) => (
                      <SelectItem key={st} value={st} className="text-xs">
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={goToPrevStep}
          className="rounded-xl px-5 text-xs h-11 border-slate-200"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl px-7 text-xs h-11"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue to Order Summary
        </Button>
      </div>
    </form>
  );
}
