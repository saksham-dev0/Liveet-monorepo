import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();
    if (!user) throw new Error("User not found");

    const details = await ctx.db
      .query("paymentDetails")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", propertyId))
      .first();

    if (details && details.operatorId !== user._id) throw new Error("Unauthorized");
    return details;
  },
});

export const upsert = mutation({
  args: {
    propertyId: v.id("properties"),
    accountName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    ifscCode: v.optional(v.string()),
    upiId: v.optional(v.string()),
    qrImageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();
    if (!user) throw new Error("User not found");

    const property = await ctx.db.get(args.propertyId);
    if (!property || property.operatorId !== user._id) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("paymentDetails")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", args.propertyId))
      .first();

    const { propertyId, ...fields } = args;

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    } else {
      return ctx.db.insert("paymentDetails", {
        propertyId,
        operatorId: user._id,
        ...fields,
      });
    }
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return ctx.storage.generateUploadUrl();
  },
});

export const getQrUrl = query({
  args: { storageId: v.optional(v.string()) },
  handler: async (ctx, { storageId }) => {
    if (!storageId) return null;
    return ctx.storage.getUrl(storageId as any);
  },
});
