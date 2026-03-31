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
    /** Free-form copy shown on tenant property detail */
    description: v.optional(v.string()),
    /** Operator-uploaded hero image for tenant discovery cards */
    coverImageFileId: v.optional(v.id("_storage")),
    /** Additional property photos (gallery) */
    galleryImageFileIds: v.optional(v.array(v.id("_storage"))),
    /** Listing amenities shown to tenants */
    amenities: v.optional(v.array(v.string())),
    /** e.g. "Metro station – 5 min walk" */
    nearbyPlaces: v.optional(v.array(v.string())),
    /** Listing-only: utilities (post-onboarding operator edits) */
    utilities: v.optional(v.array(v.string())),
  }).index("by_user", ["userId"]),

  /** Per-image gallery for property listing (max 10); not used in onboarding flow */
  propertyListingGalleryItems: defineTable({
    propertyId: v.id("properties"),
    fileId: v.id("_storage"),
    description: v.optional(v.string()),
    sortOrder: v.number(),
  }).index("by_property", ["propertyId"]),

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

  /** Chat conversations between a tenant and an operator about a specific property. */
  conversations: defineTable({
    propertyId: v.id("properties"),
    tenantUserId: v.id("users"),
    operatorUserId: v.id("users"),
    lastMessageAt: v.optional(v.number()),
    lastMessageText: v.optional(v.string()),
    tenantUnreadCount: v.optional(v.number()),
    operatorUnreadCount: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantUserId"])
    .index("by_operator", ["operatorUserId"])
    .index("by_property_and_tenant", ["propertyId", "tenantUserId"]),

  /** Individual messages in a conversation. */
  messages: defineTable({
    conversationId: v.id("conversations"),
    senderUserId: v.id("users"),
    senderRole: v.union(v.literal("tenant"), v.literal("operator")),
    body: v.string(),
  }).index("by_conversation", ["conversationId"]),

  /** In-app notifications sent to tenants (e.g. complaint resolved). */
  notifications: defineTable({
    tenantUserId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    read: v.optional(v.boolean()),
    /** Reference ID — e.g. complaintId for complaint-resolved notifications */
    refId: v.optional(v.string()),
  }).index("by_tenant", ["tenantUserId"]),

  /** Rent transactions (extend-stay payments made by tenants). */
  rentTransactions: defineTable({
    tenantUserId: v.id("users"),
    propertyId: v.id("properties"),
    applicationId: v.id("tenantMoveInApplications"),
    type: v.union(v.literal("monthly"), v.literal("quarterly"), v.literal("renewal")),
    months: v.number(),
    amount: v.number(),
    status: v.union(v.literal("paid"), v.literal("pending")),
    description: v.string(),
  })
    .index("by_tenant", ["tenantUserId"])
    .index("by_application", ["applicationId"]),

  /** Move-out requests filed by tenants. */
  moveOutRequests: defineTable({
    tenantUserId: v.id("users"),
    propertyId: v.id("properties"),
    applicationId: v.optional(v.id("tenantMoveInApplications")),
    requestedMoveOutDate: v.string(),
    status: v.optional(v.union(v.literal("open"), v.literal("approved"), v.literal("rejected"))),
  })
    .index("by_tenant", ["tenantUserId"])
    .index("by_property", ["propertyId"]),

  /** Shift requests filed by tenants to change their room. */
  shiftRequests: defineTable({
    tenantUserId: v.id("users"),
    propertyId: v.id("properties"),
    applicationId: v.optional(v.id("tenantMoveInApplications")),
    currentRoomNumber: v.string(),
    reason: v.string(),
    status: v.optional(v.union(v.literal("open"), v.literal("approved"), v.literal("rejected"))),
  })
    .index("by_tenant", ["tenantUserId"])
    .index("by_property", ["propertyId"]),

  /** Complaints filed by tenants against their property. */
  complaints: defineTable({
    tenantUserId: v.id("users"),
    propertyId: v.id("properties"),
    /** applicationId links to tenantMoveInApplications for operator task routing */
    applicationId: v.optional(v.id("tenantMoveInApplications")),
    problemTitle: v.string(),
    description: v.string(),
    priority: v.union(v.literal("High"), v.literal("Medium"), v.literal("Low")),
    imageFileId: v.optional(v.id("_storage")),
    status: v.optional(v.union(v.literal("open"), v.literal("pending_confirmation"), v.literal("resolved"))),
  })
    .index("by_tenant", ["tenantUserId"])
    .index("by_property", ["propertyId"])
    .index("by_application", ["applicationId"]),

  /** Notifications sent to operators (e.g. late entry requests, complaints). */
  operatorNotifications: defineTable({
    operatorUserId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    read: v.optional(v.boolean()),
    refId: v.optional(v.string()),
  }).index("by_operator", ["operatorUserId"]),

  /** Communities created by tenants/users. */
  communities: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    createdByUserId: v.id("users"),
    isPublic: v.optional(v.boolean()),
  }).index("by_creator", ["createdByUserId"]),

  /** Community memberships. */
  communityMembers: defineTable({
    communityId: v.id("communities"),
    userId: v.id("users"),
  })
    .index("by_community", ["communityId"])
    .index("by_user", ["userId"])
    .index("by_community_and_user", ["communityId", "userId"]),

  /** Hangouts created within or outside a community. */
  hangouts: defineTable({
    communityId: v.optional(v.id("communities")),
    createdByUserId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    dateTime: v.string(),
    maxAttendees: v.optional(v.number()),
    status: v.optional(v.union(v.literal("open"), v.literal("closed"), v.literal("cancelled"))),
  })
    .index("by_creator", ["createdByUserId"])
    .index("by_community", ["communityId"]),

  /** Hangout join requests / RSVPs. */
  hangoutAttendees: defineTable({
    hangoutId: v.id("hangouts"),
    userId: v.id("users"),
    status: v.optional(v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected"))),
  })
    .index("by_hangout", ["hangoutId"])
    .index("by_user", ["userId"])
    .index("by_hangout_and_user", ["hangoutId", "userId"]),

  /** Late entry requests filed by tenants. */
  lateEntryRequests: defineTable({
    tenantUserId: v.id("users"),
    propertyId: v.id("properties"),
    applicationId: v.optional(v.id("tenantMoveInApplications")),
    entryTime: v.string(),
    reason: v.string(),
    emergencyContact: v.string(),
    status: v.optional(v.union(v.literal("open"), v.literal("approved"), v.literal("rejected"))),
  })
    .index("by_tenant", ["tenantUserId"])
    .index("by_property", ["propertyId"]),

  /** Tenant move-in (E-KYC + details) for a liked property; upserted per tenant+property. */
  tenantMoveInApplications: defineTable({
    tenantUserId: v.id("users"),
    propertyId: v.id("properties"),
    status: v.optional(v.string()),

    legalNameAsOnId: v.optional(v.string()),
    govIdType: v.optional(v.string()),
    govIdOtherLabel: v.optional(v.string()),
    govIdNumber: v.optional(v.string()),
    idFrontFileId: v.optional(v.id("_storage")),
    idBackFileId: v.optional(v.id("_storage")),

    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    maritalStatus: v.optional(v.union(v.literal("married"), v.literal("single"))),
    address: v.optional(v.string()),
    /** Preferred or planned move-in date (free-form, e.g. DD/MM/YYYY). */
    moveInDate: v.optional(v.string()),
    professionalDetails: v.optional(v.string()),
    selectedRoomOptionId: v.optional(v.id("roomOptions")),
    paymentMethod: v.optional(
      v.union(v.literal("Bank transfer"), v.literal("UPI"), v.literal("Cash")),
    ),
    paymentStatus: v.optional(v.union(v.literal("paid"), v.literal("pending"))),
    assignedAt: v.optional(v.number()),
    assignedRoomId: v.optional(v.id("rooms")),
    assignedRoomNumber: v.optional(v.string()),
    agreementAccepted: v.optional(v.boolean()),

    emergencyContacts: v.optional(v.array(
      v.object({
        name: v.string(),
        phone: v.string(),
        relation: v.string(),
      }),
    )),

    /** Set when a move-out request is approved by the operator */
    moveOutDate: v.optional(v.string()),

    /** Operator onboarding fields set when processing a quick move-in request */
    onboardingSecurityDeposit: v.optional(v.number()),
    onboardingAgreementDuration: v.optional(v.string()),
    onboardingRentCycle: v.optional(v.string()),
    onboardingRentCycleCustomDay: v.optional(v.number()),
    onboardingExtraCharges: v.optional(v.string()),
  })
    .index("by_tenant", ["tenantUserId"])
    .index("by_property", ["propertyId"])
    .index("by_tenant_and_property", ["tenantUserId", "propertyId"]),
});

