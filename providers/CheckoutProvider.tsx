// providers/CheckoutProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { CheckoutData, PickupLocation } from "@/types/checkout.type";
import { validateContactInfo, validateShippingAddress } from "@/lib/checkout";

interface CheckoutContextType {
  checkoutData: CheckoutData;
  updateCheckoutData: (data: Partial<CheckoutData>) => void;
  clearCheckoutData: () => void;
  pickupLocations: PickupLocation[];
  isLoadingLocations: boolean;
  currentStep: number;
  goToNextStep: () => void;
  goToPrevStep: () => void;
  goToStep: (step: number) => void;
  validateCurrentStep: () => boolean;
  errors: Record<string, string[]>;
}

const CheckoutContext = createContext<CheckoutContextType | undefined>(
  undefined
);

const STORAGE_KEY = "checkoutData";

export function CheckoutProvider({ children }: { children: React.ReactNode }) {
  const [checkoutData, setCheckoutData] = useState<CheckoutData>({
    deliveryMethod: "shipping",
    contactInfo: { name: "", email: "", phone: "" },
    shippingAddress: undefined,
    pickupLocationId: "",
  });
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Load saved checkout data
  useEffect(() => {
    const loadData = () => {
      try {
        const savedData =
          typeof window !== "undefined"
            ? JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null")
            : null;
        if (savedData) {
          setCheckoutData(savedData);
        }
      } catch (err) {
        console.error("Failed to load checkout data:", err);
      }
    };

    loadData();
  }, []);

  // Save checkout data
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(checkoutData));
    } catch (err) {
      console.error("Failed to save checkout data:", err);
    }
  }, [checkoutData]);

  // Load pickup locations
  useEffect(() => {
    const timer = setTimeout(() => {
      setPickupLocations(DEMO_PICKUP_LOCATIONS);
      setIsLoadingLocations(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const updateCheckoutData = useCallback(
    async (data: Partial<CheckoutData>) => {
      setCheckoutData((prev) => {
        const newData = { ...prev, ...data };
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        } catch (err) {
          console.error("Failed to save checkout data:", err);
        }
        return newData;
      });
      setErrors({});
    },
    []
  );

  const clearCheckoutData = useCallback(() => {
    setCheckoutData({
      deliveryMethod: "shipping",
      contactInfo: { name: "", email: "", phone: "" },
    });
    setCurrentStep(1);
    setErrors({});
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error("Failed to clear checkout data:", err);
    }
  }, []);

  const validateCurrentStep = useCallback(() => {
    const newErrors: Record<string, string[]> = {};
    let isValid = true;

    switch (currentStep) {
      case 1: // Delivery method + contact info
        const contactErrors = validateContactInfo(checkoutData.contactInfo);
        if (contactErrors.length > 0) {
          newErrors.contactInfo = contactErrors;
          isValid = false;
        }
        break;

      case 2: // Address or pickup location
        if (checkoutData.deliveryMethod === "shipping") {
          const addressErrors = validateShippingAddress(
            checkoutData.shippingAddress
          );
          if (addressErrors.length > 0) {
            newErrors.shippingAddress = addressErrors;
            isValid = false;
          }
        } else if (!checkoutData.pickupLocationId) {
          newErrors.pickupLocation = ["Pickup location is required"];
          isValid = false;
        }
        break;

      case 3: // Order summary
        // Additional validation if needed
        break;
    }

    setErrors(newErrors);
    return isValid;
  }, [currentStep, checkoutData]);

  const goToNextStep = useCallback(async () => {
    if (validateCurrentStep()) {
      try {
        // Save data before proceeding
        await updateCheckoutData(checkoutData);
        setCurrentStep((prev) => Math.min(prev + 1, 4));
        return true;
      } catch (error) {
        console.error("Failed to proceed to next step:", error);
        return false;
      }
    }
    return false;
  }, [validateCurrentStep, checkoutData, updateCheckoutData]);

  const goToPrevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(Math.max(1, Math.min(step, 4)));
  }, []);

  return (
    <CheckoutContext.Provider
      value={{
        checkoutData,
        updateCheckoutData,
        clearCheckoutData,
        pickupLocations,
        isLoadingLocations,
        currentStep,
        goToNextStep,
        goToPrevStep,
        goToStep,
        validateCurrentStep,
        errors,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (context === undefined) {
    throw new Error("useCheckout must be used within a CheckoutProvider");
  }
  return context;
}

// Demo data remains the same
const DEMO_PICKUP_LOCATIONS: PickupLocation[] = [
  {
    id: "main-office",
    name: "Main Office",
    address: "41 Lagos/Badagry Expressway, Ile-Epo Bus-stop, Lagos, Nigeria",
  },
  // ...other locations
];
