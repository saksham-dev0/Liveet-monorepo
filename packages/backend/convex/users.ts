import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const ensureCurrentUser = mutation({
  args: {
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Unauthenticated call to ensureCurrentUser");
    }

    const tokenIdentifier = identity.tokenIdentifier;
    if (!tokenIdentifier) {
      throw new Error("Missing tokenIdentifier on identity");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier),
      )
      .unique();

    if (!existing) {
      const userId = await ctx.db.insert("users", {
        tokenIdentifier,
        clerkUserId: identity.subject,
        email: identity.email,
        name: identity.name,
        imageUrl: identity.pictureUrl,
        role: args.role,
        hasCompletedOnboarding: false,
      });
      return { userId };
    }

    // Only update fields that haven't been set by the user during onboarding.
    // name and imageUrl are set during onboarding and must not be overwritten by Clerk.
    const patchFields: Record<string, unknown> = {
      tokenIdentifier,
      clerkUserId: identity.subject,
      email: identity.email,
    };
    if (!existing.name && identity.name) patchFields.name = identity.name;
    if (!existing.imageUrl && identity.pictureUrl) patchFields.imageUrl = identity.pictureUrl;
    if (args.role && !existing.role) patchFields.role = args.role;

    await ctx.db.patch(existing._id, patchFields);
    return { userId: existing._id };
  },
});

export const completeOnboarding = mutation({
  args: {
    name: v.string(),
    property: v.object({
      propertyType: v.string(),
      name: v.string(),
      addressLine1: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      pincode: v.optional(v.string()),
      totalUnits: v.optional(v.string()),
      roomTypes: v.optional(v.array(v.string())),
      amenities: v.optional(v.array(v.string())),
      tenantGender: v.optional(v.string()),
      tenantFood: v.optional(v.string()),
      tenantOccupation: v.optional(v.string()),
      agreementDuration: v.optional(v.string()),
      noticePeriod: v.optional(v.string()),
      roomPricings: v.optional(
        v.array(v.object({ roomType: v.string(), rent: v.string(), deposit: v.string(), bookingAmount: v.optional(v.string()) }))
      ),
      additionalCharges: v.optional(
        v.array(v.object({ id: v.string(), amount: v.string() }))
      ),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      name: args.name,
      hasCompletedOnboarding: true,
    });

    const propertyId = await ctx.db.insert("properties", {
      operatorId: user._id,
      ...args.property,
    });

    await ctx.db.insert("propertyMembers", {
      propertyId,
      userId: user._id,
      role: "owner",
      joinedAt: Date.now(),
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
  },
});

export const updateMyProperty = mutation({
  args: {
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    occupancyType: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    propertyType: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    pincode: v.optional(v.string()),
    totalUnits: v.optional(v.string()),
    roomTypes: v.optional(v.array(v.string())),
    amenities: v.optional(v.array(v.string())),
    tenantGender: v.optional(v.string()),
    tenantFood: v.optional(v.string()),
    tenantOccupation: v.optional(v.string()),
    agreementDuration: v.optional(v.string()),
    noticePeriod: v.optional(v.string()),
    roomPricings: v.optional(
      v.array(v.object({ roomType: v.string(), rent: v.string(), deposit: v.string(), bookingAmount: v.optional(v.string()) }))
    ),
    additionalCharges: v.optional(
      v.array(v.object({ id: v.string(), amount: v.string() }))
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) throw new Error("User not found");

    const property = await ctx.db
      .query("properties")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", user._id))
      .first();
    if (!property) throw new Error("Property not found");

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(property._id, patch);
  },
});

export const getMyProperty = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return null;

    return await ctx.db
      .query("properties")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", user._id))
      .first();
  },
});

export const completeTenantOnboarding = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    isAlreadyInLiveet: v.boolean(),
    importedTenantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      name: args.name,
      phone: args.phone,
      hasCompletedOnboarding: true,
    });
  },
});

export const lookupImportedTenantByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const tenants = await ctx.db.query("tenants").collect();
    const match = tenants.find((t) => t.studentPhone === args.phone);
    if (!match) return null;

    const property = await ctx.db.get(match.propertyId);
    const room = match.roomId ? await ctx.db.get(match.roomId) : null;

    return {
      importedTenantId: match._id,
      tenantName: match.studentName,
      propertyName: property?.name ?? null,
      propertyCity: property?.city ?? null,
      propertyState: property?.state ?? null,
      propertyLine1: property?.addressLine1 ?? null,
      roomNumber: room?.roomNumber ?? null,
      roomType: room?.type ?? null,
      rent: match.rent ?? null,
      moveInDate: null,
    };
  },
});
