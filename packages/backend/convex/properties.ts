import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listForTenants = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    const swipedPropertyIds = new Set<string>();
    if (user) {
      const swipes = await ctx.db
        .query("tenantPropertySwipes")
        .withIndex("by_tenant", (q) => q.eq("tenantUserId", user._id))
        .take(500);
      for (const s of swipes) swipedPropertyIds.add(s.propertyId);
    }

    const allProperties = await ctx.db.query("properties").take(100);

    const unswiped = allProperties.filter(
      (p) => !swipedPropertyIds.has(p._id),
    );

    const enriched = [];
    for (const property of unswiped) {
      const { coverImageFileId, ...propertyRest } = property;
      const coverImageUrl = coverImageFileId
        ? await ctx.storage.getUrl(coverImageFileId)
        : null;

      const roomOptions = await ctx.db
        .query("roomOptions")
        .withIndex("by_property_and_category", (q) =>
          q.eq("propertyId", property._id),
        )
        .take(20);

      const tenantDetails = await ctx.db
        .query("propertyTenantDetails")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .unique();

      const agreement = await ctx.db
        .query("propertyAgreement")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .unique();

      const rent = await ctx.db
        .query("propertyRent")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .unique();

      enriched.push({
        ...propertyRest,
        coverImageUrl,
        roomOptions: roomOptions ?? [],
        tenantDetails: tenantDetails ?? null,
        agreement: agreement ?? null,
        rent: rent ?? null,
      });
    }

    return enriched;
  },
});

export const listLikedForTenants = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) return [];

    // Fetch swipes for this tenant and keep only liked ones.
    const swipes = await ctx.db
      .query("tenantPropertySwipes")
      .withIndex("by_tenant", (q) => q.eq("tenantUserId", user._id))
      .order("desc")
      .take(200);

    const likedPropertyIds: string[] = [];
    const seen = new Set<string>();
    for (const s of swipes) {
      if (!s.liked) continue;
      const pid = s.propertyId;
      if (seen.has(pid)) continue;
      seen.add(pid);
      likedPropertyIds.push(pid);
    }

    if (!likedPropertyIds.length) return [];

    const enriched: any[] = [];
    for (const propertyId of likedPropertyIds) {
      const property = await ctx.db.get("properties", propertyId);
      if (!property) continue;

      const { coverImageFileId, ...propertyRest } = property;
      const coverImageUrl = coverImageFileId
        ? await ctx.storage.getUrl(coverImageFileId)
        : null;

      const roomOptions = await ctx.db
        .query("roomOptions")
        .withIndex("by_property_and_category", (q) =>
          q.eq("propertyId", property._id),
        )
        .take(20);

      const tenantDetails = await ctx.db
        .query("propertyTenantDetails")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .unique();

      const agreement = await ctx.db
        .query("propertyAgreement")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .unique();

      const rent = await ctx.db
        .query("propertyRent")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .unique();

      enriched.push({
        ...propertyRest,
        coverImageUrl,
        roomOptions: roomOptions ?? [],
        tenantDetails: tenantDetails ?? null,
        agreement: agreement ?? null,
        rent: rent ?? null,
      });
    }

    return enriched;
  },
});

export const recordSwipe = mutation({
  args: {
    propertyId: v.id("properties"),
    liked: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("tenantPropertySwipes")
      .withIndex("by_tenant_and_property", (q) =>
        q.eq("tenantUserId", user._id).eq("propertyId", args.propertyId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { liked: args.liked });
    } else {
      await ctx.db.insert("tenantPropertySwipes", {
        tenantUserId: user._id,
        propertyId: args.propertyId,
        liked: args.liked,
      });
    }
  },
});
