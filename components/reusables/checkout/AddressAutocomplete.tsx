// components/checkout/AddressAutocomplete.tsx
"use client";

/* eslint-disable  @typescript-eslint/no-explicit-any */

// Add global declaration for window.google
declare global {
  interface Window {
    google: any;
  }
}

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddressAutocompleteProps {
  onSelect: (address: { street: string; city: string; state: string }) => void;
}

export function AddressAutocomplete({ onSelect }: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.google) {
      const autocomplete = new window.google.maps.places.Autocomplete(
        inputRef.current!,
        {
          types: ["address"],
          componentRestrictions: { country: "ng" },
          fields: ["address_components", "formatted_address"],
        }
      );

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.address_components) return;

        const address = {
          street: place.formatted_address,
          city: "",
          state: "",
        };

        place.address_components.forEach(
          (component: { types: string | string[]; long_name: string }) => {
            if (component.types.includes("locality")) {
              address.city = component.long_name;
            }
            if (component.types.includes("administrative_area_level_1")) {
              address.state = component.long_name;
            }
          }
        );

        onSelect(address);
      });

      autocompleteRef.current = autocomplete;
    }

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(
          autocompleteRef.current
        );
      }
    };
  }, [onSelect]);

  return (
    <div className="space-y-2 mb-4">
      <Label>Search Address</Label>
      <Input
        ref={inputRef}
        placeholder="Start typing your address..."
        type="text"
      />
    </div>
  );
}
