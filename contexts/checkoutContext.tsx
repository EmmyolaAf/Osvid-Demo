"use client";
import { createContext, ReactNode, useState } from "react";

export interface ICheckoutItem {
  img?: string;
  name: string;
  unitPrice: number;
  productId: string;
  totalPrice?: number;
  quantityOrdered?: number;
}

export type UseCheckoutItemsType = {
  addItem: (newItem: ICheckoutItem) => void;
  removeItem: (id: string, all?: boolean) => void;
};

interface ICheckoutContext {
  isOpen: boolean;
  toggleCheckout: () => void;
  checkoutItems: ICheckoutItem[];
  useCheckoutItems: () => UseCheckoutItemsType;
}

export const CheckoutContext = createContext<ICheckoutContext>(
  {} as ICheckoutContext
);

const CheckoutContextProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<ICheckoutItem[]>([]);

  const toggleCheckout = () => {
    setIsOpen((prev) => !prev);
  };

  const useCheckoutItems = () => {
    const addItem = (newItem: ICheckoutItem): void => {
      const isContained = !!checkoutItems.find(
        (item) => item.productId === newItem.productId
      );

      if (!isContained) {
        setCheckoutItems((prev) => [
          ...prev,
          { ...newItem, quantityOrdered: 1, totalPrice: newItem.unitPrice },
        ]);
      }

      if (isContained) {
        setCheckoutItems((prev) =>
          prev.map((item) => {
            if (item.productId === newItem.productId) {
              return {
                ...item,
                quantityOrdered: (item.quantityOrdered as number) + 1,
                totalPrice: (item.totalPrice as number) + item.unitPrice,
              };
            } else {
              return { ...item };
            }
          })
        );
      }
    };

    const removeItem = (id: string, all?: boolean): void => {
      const itemQuantity = checkoutItems.find((item) => item.productId === id)
        ?.quantityOrdered as number;

      if (itemQuantity === 1 || all) {
        setCheckoutItems((prev) =>
          prev.filter((item) => item.productId !== id)
        );
      }

      if (itemQuantity > 1) {
        setCheckoutItems((prev) =>
          prev.map((item) => {
            if (item.productId === id) {
              return {
                ...item,
                quantityOrdered: (item.quantityOrdered as number) - 1,
                totalPrice: (item.totalPrice as number) - item.unitPrice,
              };
            } else {
              return { ...item };
            }
          })
        );
      }
    };

    return { addItem, removeItem };
  };

  return (
    <CheckoutContext.Provider
      value={{ isOpen, checkoutItems, toggleCheckout, useCheckoutItems }}
    >
      {children}
    </CheckoutContext.Provider>
  );
};

export default CheckoutContextProvider;
