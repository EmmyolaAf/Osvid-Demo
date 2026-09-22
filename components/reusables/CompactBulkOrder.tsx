import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ShoppingCart, Headset } from "lucide-react";
import Link from "next/link";

interface BulkDiscountProps {
  percentage: number;
  minItems: number;
}

export const BulkDiscount = ({ percentage, minItems }: BulkDiscountProps) => {
  if (!percentage || percentage <= 0) return null;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-osvid-soft-yellow/5 to-osvid-orange/10 shadow-lg transition-all hover:shadow-xl">
      <CardHeader className="">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary p-2 text-white">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-primary">
            Bulk Discount Available
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Buy {minItems}+ items and enjoy{" "}
            <span className="font-bold text-primary">{percentage}% off</span>{" "}
            your entire purchase!
          </p>

          <div className="flex items-center gap-2 text-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Headset className="h-4 w-4 " />
            </div>
            <p className="text-xs">
              Contact our{" "}
              <Button
                variant="link"
                className="h-auto p-0 !text-xs text-primary underline"
                asChild
              >
                <Link
                  target="_blank"
                  href="https://wa.me/2349121090303"
                  className="font-semibold"
                >
                  sales team
                </Link>
              </Button>{" "}
              to claim this offer
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
