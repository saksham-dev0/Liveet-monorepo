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
    phone: v.optional(v.string()),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  floors: defineTable({
    propertyId: v.id("properties"),
    operatorId: v.id("users"),
    label: v.string(),
    short: v.string(),
    order: v.number(),
  })
    .index("by_propertyId", ["propertyId"])
    .index("by_operatorId", ["operatorId"]),

  rooms: defineTable({
    propertyId: v.id("properties"),
    floorId: v.id("floors"),
    operatorId: v.id("users"),
    roomNumber: v.string(),
    type: v.string(),
    capacity: v.number(),
    rent: v.optional(v.number()),
    deposit: v.optional(v.number()),
  })
    .index("by_propertyId", ["propertyId"])
    .index("by_floorId", ["floorId"])
    .index("by_operatorId", ["operatorId"]),

  propertyMembers: defineTable({
    propertyId: v.id("properties"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("manager")),
    invitedBy: v.optional(v.id("users")),
    joinedAt: v.number(),
  })
    .index("by_propertyId", ["propertyId"])
    .index("by_userId", ["userId"])
    .index("by_propertyId_userId", ["propertyId", "userId"]),

  propertyInvites: defineTable({
    propertyId: v.id("properties"),
    email: v.string(),
    token: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked")
    ),
    invitedBy: v.id("users"),
    expiresAt: v.number(),
  })
    .index("by_propertyId", ["propertyId"])
    .index("by_token", ["token"])
    .index("by_email", ["email"]),

  tenants: defineTable({
    propertyId: v.id("properties"),
    operatorId: v.id("users"),
    roomId: v.optional(v.id("rooms")),
    studentName: v.string(),
    studentPhone: v.string(),
    studentEmail: v.optional(v.string()),
    course: v.optional(v.string()),
    parentName: v.optional(v.string()),
    parentPhone: v.optional(v.string()),
    parentEmail: v.optional(v.string()),
    rent: v.optional(v.number()),
    advance: v.optional(v.number()),
    security: v.optional(v.number()),
    booking: v.optional(v.number()),
    maintenance: v.optional(v.number()),
    customCharges: v.optional(
      v.array(v.object({ id: v.string(), label: v.string(), amount: v.number() }))
    ),
    moveInAmount: v.optional(v.number()),
    paymentStatus: v.union(
      v.literal("paid"),
      v.literal("partial"),
      v.literal("pending")
    ),
    paymentHistory: v.optional(
      v.array(
        v.object({
          id: v.string(),
          amount: v.number(),
          status: v.union(v.literal("paid"), v.literal("partial"), v.literal("pending")),
          note: v.optional(v.string()),
          items: v.optional(v.array(v.string())),
          createdAt: v.number(),
        })
      )
    ),
    createdAt: v.number(),
  })
    .index("by_propertyId", ["propertyId"])
    .index("by_operatorId", ["operatorId"]),

  paymentDetails: defineTable({
    propertyId: v.id("properties"),
    operatorId: v.id("users"),
    accountName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    ifscCode: v.optional(v.string()),
    upiId: v.optional(v.string()),
    qrImageId: v.optional(v.string()),
  })
    .index("by_propertyId", ["propertyId"])
    .index("by_operatorId", ["operatorId"]),

  properties: defineTable({
    operatorId: v.id("users"),
    propertyType: v.string(),
    name: v.string(),
    addressLine1: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    pincode: v.optional(v.string()),
    totalUnits: v.optional(v.string()),
    roomTypes: v.optional(v.array(v.string())),
    amenities: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    occupancyType: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    tenantGender: v.optional(v.string()),
    tenantFood: v.optional(v.string()),
    tenantOccupation: v.optional(v.string()),
    agreementDuration: v.optional(v.string()),
    noticePeriod: v.optional(v.string()),
    roomPricings: v.optional(
      v.array(
        v.object({
          roomType: v.string(),
          rent: v.string(),
          deposit: v.string(),
          bookingAmount: v.optional(v.string()),
        })
      )
    ),
    additionalCharges: v.optional(
      v.array(v.object({ id: v.string(), amount: v.string() }))
    ),
    agreementPdfId: v.optional(v.string()),
  }).index("by_operatorId", ["operatorId"]),

  propertyLikes: defineTable({
    userId: v.id("users"),
    propertyId: v.id("properties"),
    liked: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_propertyId", ["userId", "propertyId"]),

  bookingRequests: defineTable({
    propertyId: v.id("properties"),
    userId: v.id("users"),
    studentName: v.string(),
    studentPhone: v.string(),
    studentEmail: v.optional(v.string()),
    course: v.optional(v.string()),
    yearOfStudy: v.optional(v.string()),
    parentName: v.optional(v.string()),
    parentPhone: v.optional(v.string()),
    parentEmail: v.optional(v.string()),
    moveInDate: v.string(),
    foodPreference: v.optional(v.string()),
    roomTypePreference: v.optional(v.string()),
    paymentProofId: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected")),
    bookingPaymentItems: v.optional(v.array(v.object({
      key: v.string(),
      label: v.string(),
      amount: v.number(),
    }))),
    createdAt: v.number(),
  })
    .index("by_propertyId", ["propertyId"])
    .index("by_userId", ["userId"]),

  tenantKyc: defineTable({
    tenantId: v.id("tenants"),
    propertyId: v.id("properties"),
    operatorId: v.id("users"),
    userId: v.id("users"),
    idProofType: v.optional(v.string()),
    idProofNumber: v.optional(v.string()),
    idProofFrontStorageId: v.optional(v.string()),
    idProofBackStorageId: v.optional(v.string()),
    idProofStatus: v.optional(
      v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"))
    ),
    legalName: v.optional(v.string()),
    profilePhotoStorageId: v.optional(v.string()),
    profilePhotoStatus: v.optional(
      v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"))
    ),
    agreementStorageId: v.optional(v.string()),
    agreementSignedAt: v.optional(v.number()),
    digitalSignatureName: v.optional(v.string()),
    agreementStatus: v.optional(
      v.union(v.literal("pending"), v.literal("signed"), v.literal("verified"))
    ),
    overallStatus: v.union(
      v.literal("incomplete"),
      v.literal("pending"),
      v.literal("verified")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenantId", ["tenantId"])
    .index("by_propertyId", ["propertyId"])
    .index("by_operatorId", ["operatorId"])
    .index("by_userId", ["userId"]),

  tasks: defineTable({
    operatorId: v.id("users"),
    propertyId: v.optional(v.id("properties")),
    title: v.string(),
    kind: v.string(),
    priority: v.union(v.literal("High"), v.literal("Med"), v.literal("Low")),
    status: v.union(v.literal("todo"), v.literal("doing"), v.literal("done")),
    bucket: v.union(v.literal("overdue"), v.literal("today"), v.literal("week"), v.literal("later")),
    due: v.optional(v.string()),
    linkedType: v.optional(v.string()),
    linkedLabel: v.optional(v.string()),
    linkedSub: v.optional(v.string()),
    assigneeName: v.optional(v.string()),
    assigneeRole: v.optional(v.string()),
    desc: v.optional(v.string()),
    subtasks: v.optional(v.array(v.object({ t: v.string(), done: v.boolean() }))),
    createdAt: v.number(),
  })
    .index("by_operatorId", ["operatorId"])
    .index("by_operatorId_status", ["operatorId", "status"]),

  lateEntryRequests: defineTable({
    userId: v.id("users"),
    propertyId: v.id("properties"),
    operatorId: v.id("users"),
    date: v.string(),
    time: v.string(),
    reason: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_operatorId", ["operatorId"])
    .index("by_propertyId", ["propertyId"]),

  extendStayRequests: defineTable({
    userId: v.id("users"),
    propertyId: v.id("properties"),
    operatorId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_operatorId", ["operatorId"])
    .index("by_propertyId", ["propertyId"]),

  roomChangeRequests: defineTable({
    userId: v.id("users"),
    propertyId: v.id("properties"),
    operatorId: v.id("users"),
    preferredRoomNumber: v.optional(v.string()),
    reason: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_operatorId", ["operatorId"])
    .index("by_propertyId", ["propertyId"]),

  moveOutRequests: defineTable({
    userId: v.id("users"),
    propertyId: v.id("properties"),
    operatorId: v.id("users"),
    moveOutDate: v.string(),
    reason: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_operatorId", ["operatorId"])
    .index("by_propertyId", ["propertyId"]),

  complaints: defineTable({
    userId: v.id("users"),
    propertyId: v.id("properties"),
    operatorId: v.id("users"),
    title: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("maintenance"),
      v.literal("cleanliness"),
      v.literal("security"),
      v.literal("noise"),
      v.literal("amenities"),
      v.literal("other")
    ),
    urgency: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    imageStorageIds: v.optional(v.array(v.string())),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_operatorId", ["operatorId"])
    .index("by_propertyId", ["propertyId"]),
});
