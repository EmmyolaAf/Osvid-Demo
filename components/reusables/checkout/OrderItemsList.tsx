// components/checkout/OrderItemsList.tsx
import Image from "next/image";
import { CartItem } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OrderItemsListProps {
  items: CartItem[];
}

export function OrderItemsList({ items }: OrderItemsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Items</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.cartItemId} className="flex gap-4">
              <div className="relative aspect-square w-16 overflow-hidden rounded-md border">
                <Image
                  src={item.media?.mainMedia?.image?.url || ""}
                  alt={item.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <h3 className="font-medium">{item.name}</h3>
                  <span>
                    {item.priceData?.formatted?.discountedPrice ||
                      item.priceData?.formatted?.price}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground">
                  Qty: {item.quantity}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
