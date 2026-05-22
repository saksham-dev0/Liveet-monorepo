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
});
