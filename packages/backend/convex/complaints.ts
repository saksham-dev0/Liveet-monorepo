import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getAuthedUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();
  if (!user) throw new Error("User not found");
  return user;
}

async function getAcceptedBooking(ctx: any, userId: any) {
  const booking = await ctx.db
    .query("bookingRequests")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();
  if (!booking || booking.status !== "accepted") throw new Error("No active booking found");
  return booking;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getAuthedUser(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const getImageUrl = query({
  args: { storageId: v.optional(v.string()) },
  handler: async (ctx, { storageId }) => {
    if (!storageId) return null;
    return ctx.storage.getUrl(storageId as any);
  },
});

export const submitComplaint = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    const booking = await getAcceptedBooking(ctx, user._id);
    const property = await ctx.db.get(booking.propertyId);
    if (!property) throw new Error("Property not found");

    return ctx.db.insert("complaints", {
      userId: user._id,
      propertyId: booking.propertyId,
      operatorId: property.operatorId,
      title: args.title,
      description: args.description,
      category: args.category,
      urgency: args.urgency,
      imageStorageIds: args.imageStorageIds,
      status: "open",
      createdAt: Date.now(),
    });
  },
});

export const listMyComplaints = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return [];
    return ctx.db
      .query("complaints")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});
