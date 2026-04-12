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

    const baseFields = {
      tokenIdentifier,
      clerkUserId: identity.subject,
      email: identity.email,
      name: identity.name,
      imageUrl: identity.pictureUrl,
    };

    if (!existing) {
      const userId = await ctx.db.insert("users", {
        ...baseFields,
        role: args.role,
        hasCompletedOnboarding: false,
      });
      return { userId };
    }

    const patchFields: Record<string, unknown> = { ...baseFields };
    if (args.role && !existing.role) {
      patchFields.role = args.role;
    }
    await ctx.db.patch(existing._id, patchFields);
    return { userId: existing._id };
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    return user;
  },
});

export const updateUserProfile = mutation({
  args: {
    name: v.optional(v.string()),
    brandName: v.optional(v.string()),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    profileImageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) throw new Error("User not found");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.brandName !== undefined) patch.brandName = args.brandName;
    if (args.phone !== undefined) patch.phone = args.phone;
    if (args.dateOfBirth !== undefined) patch.dateOfBirth = args.dateOfBirth;
    if (args.profileImageStorageId !== undefined) {
      if (
        user.profileImageStorageId != null &&
        user.profileImageStorageId !== args.profileImageStorageId
      ) {
        await ctx.storage.delete(user.profileImageStorageId);
      }
      patch.profileImageStorageId = args.profileImageStorageId;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user._id, patch);
    }
  },
});

export const generateProfileImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) throw new Error("Unauthenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

export const getProfileImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) throw new Error("User not found");

    if (user.profileImageStorageId !== args.storageId) {
      throw new Error("Unauthorized: storageId does not belong to current user");
    }

    return await ctx.storage.getUrl(args.storageId);
  },
});

export const deleteOperatorAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) throw new Error("User not found");

    const userId = user._id;

    // Delete onboarding profile
    const onboardingProfiles = await ctx.db
      .query("onboardingProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const doc of onboardingProfiles) await ctx.db.delete(doc._id);

    // Delete business profile
    const businessProfiles = await ctx.db
      .query("businessProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const doc of businessProfiles) await ctx.db.delete(doc._id);

    // Delete payment accounts
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const doc of accounts) await ctx.db.delete(doc._id);

    // Delete properties and all nested data
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const property of properties) {
      const propertyId = property._id;

      // Delete gallery items
      const galleryItems = await ctx.db
        .query("propertyListingGalleryItems")
        .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
        .collect();
      for (const doc of galleryItems) await ctx.db.delete(doc._id);

      // Delete tenant details
      const tenantDetails = await ctx.db
        .query("propertyTenantDetails")
        .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
        .collect();
      for (const doc of tenantDetails) await ctx.db.delete(doc._id);

      // Delete room options
      const roomOptions = await ctx.db
        .query("roomOptions")
        .withIndex("by_property_and_category", (q) => q.eq("propertyId", propertyId))
        .collect();
      for (const doc of roomOptions) await ctx.db.delete(doc._id);

      // Delete property agreement
      const agreements = await ctx.db
        .query("propertyAgreement")
        .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
        .collect();
      for (const doc of agreements) await ctx.db.delete(doc._id);

      // Delete property rent config
      const rents = await ctx.db
        .query("propertyRent")
        .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
        .collect();
      for (const doc of rents) await ctx.db.delete(doc._id);

      // Delete extra charges
      const extraCharges = await ctx.db
        .query("propertyExtraCharges")
        .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
        .collect();
      for (const doc of extraCharges) await ctx.db.delete(doc._id);

      // Delete floors and their rooms
      const floors = await ctx.db
        .query("floors")
        .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
        .collect();
      for (const floor of floors) {
        const rooms = await ctx.db
          .query("rooms")
          .withIndex("by_floor", (q) => q.eq("floorId", floor._id))
          .collect();
        for (const room of rooms) await ctx.db.delete(room._id);
        await ctx.db.delete(floor._id);
      }

      await ctx.db.delete(propertyId);
    }

    // Delete operator notifications
    const operatorNotifications = await ctx.db
      .query("operatorNotifications")
      .withIndex("by_operator", (q) => q.eq("operatorUserId", userId))
      .collect();
    for (const doc of operatorNotifications) await ctx.db.delete(doc._id);

    // Delete conversations and their messages
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_operator", (q) => q.eq("operatorUserId", userId))
      .collect();
    for (const conversation of conversations) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversation._id),
        )
        .collect();
      for (const msg of messages) await ctx.db.delete(msg._id);
      await ctx.db.delete(conversation._id);
    }

    // Delete profile image blob if present
    if (user.profileImageStorageId != null) {
      await ctx.storage.delete(user.profileImageStorageId);
    }

    // Finally delete the user record
    await ctx.db.delete(userId);
  },
});

export const getOperatorAccounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return [];

    return await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

