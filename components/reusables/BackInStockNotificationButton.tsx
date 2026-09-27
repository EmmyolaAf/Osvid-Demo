"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { requestBackInStock } from "@/lib/firebase/storefront";
import LoadingButton from "./LoadingButton";
import { Button, ButtonProps } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { BellRing, CheckCircle2 } from "lucide-react";

const formSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required.")
    .email("Please enter a valid email address.")
    .trim()
    .toLowerCase(),
});

type FormValues = z.infer<typeof formSchema>;

interface BackInStockNotificationButtonProps extends ButtonProps {
  product: {
    _id?: string;
    id?: string;
    name: string;
    slug?: string;
  };
  selectedOptions?: Record<string, string>;
}

export default function BackInStockNotificationButton({
  product,
  selectedOptions,
  ...props
}: BackInStockNotificationButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const productId = product.id || product._id || product.slug || "unknown";

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      const result = await requestBackInStock({
        productId,
        productName: product.name,
        email: values.email,
        itemUrl: typeof window !== "undefined" ? window.location.href : undefined,
      });

      if (result.success) {
        setIsSubmitted(true);
        toast.success("Notification request submitted successfully!", {
          description: `We will email ${values.email} as soon as ${product.name} is back in stock.`,
        });
        form.reset();
        setTimeout(() => {
          setIsOpen(false);
          setIsSubmitted(false);
        }, 3000);
      } else {
        toast.error(result.error || "Failed to register notification request.");
      }
    } catch (err: any) {
      console.error("Back in stock error:", err);
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button {...props}>
          <BellRing size={16} className="mr-2" />
          Notify when available
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl max-w-md p-6 sm:p-8">
        <DialogHeader className="space-y-2 text-left">
          <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
            <BellRing size={20} />
          </div>
          <DialogTitle className="text-xl font-black text-slate-900">
            Notify When Restocked
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 leading-relaxed">
            Enter your email address and our inventory dispatch system will immediately alert you when{" "}
            <strong className="text-slate-800 font-semibold">{product.name}</strong> is available for purchase.
          </DialogDescription>
        </DialogHeader>

        {isSubmitted ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-2 bg-emerald-50 rounded-2xl border border-emerald-200">
            <CheckCircle2 size={32} className="text-emerald-600" />
            <h4 className="font-bold text-sm text-emerald-900">Request Registered</h4>
            <p className="text-xs text-emerald-700 max-w-xs px-4">
              Thank you! You will be the first to know when inventory arrives.
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase text-slate-700">
                      Your Email Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. procurement@company.com"
                        className="rounded-xl border-slate-300 py-3 text-sm focus-visible:ring-orange-500"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-red-500" />
                  </FormItem>
                )}
              />
              <LoadingButton
                type="submit"
                loading={isSubmitting}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-6 font-bold text-sm shadow-md"
              >
                Submit Notification Request
              </LoadingButton>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
