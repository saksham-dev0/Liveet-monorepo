import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    role: v.optional(v.string()),
    hasCompletedOnboarding: v.optional(v.boolean()),
    brandName: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()),
    primaryPropertyId: v.optional(v.id("properties")),
    referralCode: v.optional(v.string()),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  onboardingProfiles: defineTable({
    userId: v.id("users"),
    fullName: v.optional(v.string()),
    brandName: v.optional(v.string()),
    totalUnits: v.optional(v.number()),
    totalProperties: v.optional(v.number()),
    operatingCityIds: v.optional(v.array(v.id("cities"))),
    preferredLanguage: v.optional(v.string()),
    status: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  cities: defineTable({
    name: v.string(),
    countryCode: v.optional(v.string()),
  }).index("by_name", ["name"]),

  businessProfiles: defineTable({
    userId: v.id("users"),
    isRegistered: v.optional(v.boolean()),
    businessType: v.optional(v.string()),
    registeredName: v.optional(v.string()),
    registeredAddress: v.optional(v.string()),
    registrationDocType: v.optional(v.string()),
    registrationNumber: v.optional(v.string()),
    registrationFrontFileId: v.optional(v.id("_storage")),
    registrationBackFileId: v.optional(v.id("_storage")),
  }).index("by_user", ["userId"]),

  accounts: defineTable({
    userId: v.id("users"),
    accountType: v.string(),
    accountHolderName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    ifscCode: v.optional(v.string()),
    address: v.optional(v.string()),
    upiId: v.optional(v.string()),
    upiQrCodeFileId: v.optional(v.id("_storage")),
    isSkipped: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  properties: defineTable({
    userId: v.id("users"),
    name: v.optional(v.string()),
    totalUnits: v.optional(v.number()),
    vacantUnits: v.optional(v.number()),
    pincode: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    line1: v.optional(v.string()),
    /** Operator-uploaded hero image for tenant discovery cards */
    coverImageFileId: v.optional(v.id("_storage")),
  }).index("by_user", ["userId"]),

  propertyTenantDetails: defineTable({
    propertyId: v.id("properties"),
    canStayMale: v.optional(v.boolean()),
    canStayFemale: v.optional(v.boolean()),
    canStayOthers: v.optional(v.boolean()),
    bestForStudent: v.optional(v.boolean()),
    bestForWorkingProfessional: v.optional(v.boolean()),
  }).index("by_property", ["propertyId"]),

  roomOptions: defineTable({
    propertyId: v.id("properties"),
    category: v.string(),
    numberOfRooms: v.optional(v.number()),
    typeName: v.optional(v.string()),
    rentAmount: v.optional(v.number()),
    attachedWashroom: v.optional(v.boolean()),
    attachedBalcony: v.optional(v.boolean()),
    airConditioner: v.optional(v.boolean()),
    geyser: v.optional(v.boolean()),
    customFeatures: v.optional(v.array(v.string())),
  }).index("by_property_and_category", ["propertyId", "category"]),

  propertyAgreement: defineTable({
    propertyId: v.id("properties"),
    securityDepositDuration: v.optional(v.string()),
    agreementDuration: v.optional(v.string()),
    lockInPeriod: v.optional(v.string()),
    noticePeriod: v.optional(v.string()),
  }).index("by_property", ["propertyId"]),

  propertyRent: defineTable({
    propertyId: v.id("properties"),
    monthlyRentalCycle: v.optional(v.string()),
    gracePeriodDays: v.optional(v.number()),
    hasLateFee: v.optional(v.boolean()),
    lateFeeAmount: v.optional(v.number()),
  }).index("by_property", ["propertyId"]),

  propertyExtraCharges: defineTable({
    propertyId: v.id("properties"),
    isChargingExtra: v.optional(v.boolean()),
    type: v.optional(v.string()),
    amount: v.optional(v.number()),
    repetition: v.optional(v.string()),
    gracePeriodDays: v.optional(v.number()),
  }).index("by_property", ["propertyId"]),

  floors: defineTable({
    propertyId: v.id("properties"),
    floorNumber: v.number(),
    label: v.optional(v.string()),
  })
    .index("by_property", ["propertyId"])
    .index("by_property_and_floor", ["propertyId", "floorNumber"]),

  rooms: defineTable({
    propertyId: v.id("properties"),
    floorId: v.id("floors"),
    roomOptionId: v.optional(v.id("roomOptions")),
    roomNumber: v.string(),
    displayName: v.optional(v.string()),
    category: v.optional(v.string()),
  })
    .index("by_floor", ["floorId"])
    .index("by_property", ["propertyId"]),

  tenantPropertySwipes: defineTable({
    tenantUserId: v.id("users"),
    propertyId: v.id("properties"),
    liked: v.boolean(),
  })
    .index("by_tenant", ["tenantUserId"])
    .index("by_tenant_and_property", ["tenantUserId", "propertyId"]),
});

