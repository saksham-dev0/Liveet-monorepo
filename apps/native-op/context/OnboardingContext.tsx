import React, { createContext, useContext, useState } from "react";

type RoomPricing = { roomType: string; rent: string; deposit: string };
type AdditionalCharge = { id: string; amount: string };

export type OnboardingData = {
  // Step 1
  fullName: string;
  brandName: string;
  // Step 2
  propertyType: string;
  propertyName: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  // Step 3
  totalUnits: string;
  roomTypes: string[];
  amenities: string[];
  // Step 4
  tenantGender: string | null;
  tenantFood: string | null;
  tenantOccupation: string | null;
  // Step 5
  agreementDuration: string;
  noticePeriod: string | null;
  roomPricings: RoomPricing[];
  additionalCharges: AdditionalCharge[];
};

type OnboardingContextType = {
  data: OnboardingData;
  update: (fields: Partial<OnboardingData>) => void;
};

const defaults: OnboardingData = {
  fullName: "",
  brandName: "",
  propertyType: "",
  propertyName: "",
  addressLine1: "",
  city: "",
  state: "",
  pincode: "",
  totalUnits: "",
  roomTypes: [],
  amenities: [],
  tenantGender: null,
  tenantFood: null,
  tenantOccupation: null,
  agreementDuration: "",
  noticePeriod: null,
  roomPricings: [{ roomType: "", rent: "", deposit: "" }],
  additionalCharges: [],
};

const OnboardingContext = createContext<OnboardingContextType>({
  data: defaults,
  update: () => {},
});

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>(defaults);
  const update = (fields: Partial<OnboardingData>) =>
    setData((prev) => ({ ...prev, ...fields }));
  return (
    <OnboardingContext.Provider value={{ data, update }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export const useOnboarding = () => useContext(OnboardingContext);
