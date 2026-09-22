// components/checkout/PickupLocationStep.tsx
"use client";

import { useState } from "react";
import { MapPin, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCheckout } from "@/providers/CheckoutProvider";

export function PickupLocationStep() {
  const {
    checkoutData,
    updateCheckoutData,
    goToNextStep,
    goToPrevStep,
    pickupLocations,
    isLoadingLocations,
  } = useCheckout();

  const [selectedId, setSelectedId] = useState(
    checkoutData.pickupLocationId || ""
  );

  const handleSelect = (id: string) => {
    setSelectedId(id);
    updateCheckoutData({ pickupLocationId: id });
  };

  const handleContinue = () => {
    if (!selectedId) return;
    goToNextStep();
  };

  if (isLoadingLocations) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin" />
        <p>Loading locations...</p>
      </div>
    );
  }

  if (!pickupLocations?.length) {
    return (
      <div className="text-center py-12 space-y-4">
        <MapPin className="h-12 w-12 text-gray-400 mx-auto" />
        <h3 className="text-xl font-bold">No locations available</h3>
        <p className="text-gray-600 mb-6">
          We couldn&apos;t find any pickup locations in your area.
        </p>
        <Button onClick={goToPrevStep} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  const selectedLocation = pickupLocations.find((loc) => loc.id === selectedId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Select Pickup Location</h2>
        <p className="text-gray-600">
          Choose where you&apos;ll collect your order
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          {pickupLocations.map((location) => (
            <div
              key={location.id}
              onClick={() => handleSelect(location.id)}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedId === location.id
                  ? "border-primary bg-primary/5"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 mt-0.5 text-gray-600" />
                <div className="flex-1">
                  <h3 className="font-medium">{location.name}</h3>
                  <p className="text-sm text-gray-600">{location.address}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Open: Mon-Sat, 9am-5pm
                  </p>
                </div>
                {selectedId === location.id && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="h-64 md:h-auto rounded-lg overflow-hidden">
          {/* <PickupMap
            locations={pickupLocations}
            selectedId={selectedId}
            onSelect={handleSelect}
          /> */}
        </div>
      </div>

      {selectedLocation && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Selected Location</h4>
          <p>{selectedLocation.name}</p>
          <p className="text-sm text-muted-foreground">
            {selectedLocation.address}
          </p>
        </div>
      )}

      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={goToPrevStep}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!selectedId}>
          Continue
        </Button>
      </div>
    </div>
  );
}
