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
        })
      )
    ),
    additionalCharges: v.optional(
      v.array(v.object({ id: v.string(), amount: v.string() }))
    ),
    agreementPdfId: v.optional(v.string()),
  }).index("by_operatorId", ["operatorId"]),
});
