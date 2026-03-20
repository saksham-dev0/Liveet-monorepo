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

