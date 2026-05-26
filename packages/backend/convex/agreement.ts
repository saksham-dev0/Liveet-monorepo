import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getOperatorProperty(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .first();
  if (!user) throw new Error("User not found");
  const property = await ctx.db
    .query("properties")
    .withIndex("by_operatorId", (q: any) => q.eq("operatorId", user._id))
    .first();
  return property;
}

export const getAgreement = query({
  handler: async (ctx) => {
    const property = await getOperatorProperty(ctx);
    if (!property) return null;
    return {
      propertyId: property._id,
      agreementDuration: property.agreementDuration ?? "",
      noticePeriod: property.noticePeriod ?? null,
      roomPricings: property.roomPricings ?? [],
      additionalCharges: property.additionalCharges ?? [],
      agreementPdfId: property.agreementPdfId ?? null,
    };
  },
});

export const updateAgreement = mutation({
  args: {
    propertyId: v.id("properties"),
    agreementDuration: v.optional(v.string()),
    noticePeriod: v.optional(v.string()),
    roomPricings: v.optional(
      v.array(v.object({ roomType: v.string(), rent: v.string(), deposit: v.string() }))
    ),
    additionalCharges: v.optional(
      v.array(v.object({ id: v.string(), amount: v.string() }))
    ),
    agreementPdfId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const { propertyId, ...fields } = args;
    await ctx.db.patch(propertyId, fields);
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return ctx.storage.generateUploadUrl();
  },
});

export const getPdfUrl = query({
  args: { storageId: v.optional(v.string()) },
  handler: async (ctx, { storageId }) => {
    if (!storageId) return null;
    return ctx.storage.getUrl(storageId as any);
  },
});
