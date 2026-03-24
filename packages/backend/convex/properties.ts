import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

function ownerDisplayName(owner: Doc<"users"> | null): string | undefined {
  if (!owner) return undefined;
  const name = owner.name?.trim();
  if (name) return name;
  const brand = owner.brandName?.trim();
  if (brand) return brand;
  const email = owner.email?.trim();
  if (email) {
    const at = email.indexOf("@");
    return at > 0 ? email.slice(0, at) : email;
  }
  return undefined;
}

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
      const {
        coverImageFileId,
        galleryImageFileIds,
        ...propertyRest
      } = property;
      const coverImageUrl = coverImageFileId
        ? await ctx.storage.getUrl(coverImageFileId)
        : null;

      const galleryImageUrls: (string | null)[] = [];
      for (const id of galleryImageFileIds ?? []) {
        galleryImageUrls.push(await ctx.storage.getUrl(id));
      }

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
        galleryImageUrls,
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

    const likedPropertyIds: Id<"properties">[] = [];
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

      const {
        coverImageFileId,
        galleryImageFileIds,
        ...propertyRest
      } = property;
      const coverImageUrl = coverImageFileId
        ? await ctx.storage.getUrl(coverImageFileId)
        : null;

      const galleryImageUrls: (string | null)[] = [];
      for (const id of galleryImageFileIds ?? []) {
        galleryImageUrls.push(await ctx.storage.getUrl(id));
      }

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

      const ownerUser = await ctx.db.get(property.userId);
      const ownerName = ownerDisplayName(ownerUser);

      enriched.push({
        ...propertyRest,
        coverImageUrl,
        galleryImageUrls,
        ownerName,
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

function isMoveInKycComplete(
  app: Doc<"tenantMoveInApplications">,
): boolean {
  return (
    app.status === "submitted" ||
    app.status === undefined ||
    app.status === null
  );
}

/** Aggregates unit counts across the operator's properties for the dashboard. */
export const getDashboardPropertyStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      return null;
    }

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);

    let vacantUnits = 0;
    let occupiedUnits = 0;
    /** Tenants who completed E-KYC / move-in for any of this operator's properties (distinct users). */
    const occupantsWithKyc = new Set<Id<"users">>();

    for (const p of properties) {
      const total = p.totalUnits ?? 0;
      let vacant = p.vacantUnits;
      if (vacant === undefined && total > 0) {
        const rooms = await ctx.db
          .query("rooms")
          .withIndex("by_property", (q) => q.eq("propertyId", p._id))
          .take(1000);
        const occupiedByRooms = rooms.length;
        vacant = Math.max(0, total - occupiedByRooms);
      }
      const vacantN = vacant ?? 0;
      vacantUnits += vacantN;
      occupiedUnits += Math.max(0, total - vacantN);

      const moveInApps = await ctx.db
        .query("tenantMoveInApplications")
        .withIndex("by_property", (q) => q.eq("propertyId", p._id))
        .take(500);
      for (const app of moveInApps) {
        if (isMoveInKycComplete(app)) {
          occupantsWithKyc.add(app.tenantUserId);
        }
      }
    }

    return {
      vacantUnits,
      occupiedUnits,
      occupantsWithKyc: occupantsWithKyc.size,
    };
  },
});

/** Recent tenants who completed E-KYC / move-in on this operator's properties (newest first). */
export const getRecentKycTenantsForDashboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 8, 1), 25);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      return null;
    }

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);

    type Collected = {
      _creationTime: number;
      applicationId: Id<"tenantMoveInApplications">;
      legalNameAsOnId: string;
      phone: string;
      moveInDate: string | undefined;
      tenantUserId: Id<"users">;
    };

    const collected: Collected[] = [];

    for (const p of properties) {
      const apps = await ctx.db
        .query("tenantMoveInApplications")
        .withIndex("by_property", (q) => q.eq("propertyId", p._id))
        .take(200);

      for (const app of apps) {
        if (!isMoveInKycComplete(app)) {
          continue;
        }
        collected.push({
          _creationTime: app._creationTime,
          applicationId: app._id,
          legalNameAsOnId: app.legalNameAsOnId,
          phone: app.phone,
          moveInDate: app.moveInDate,
          tenantUserId: app.tenantUserId,
        });
      }
    }

    collected.sort((a, b) => b._creationTime - a._creationTime);

    const out: Array<{
      applicationId: Id<"tenantMoveInApplications">;
      legalNameAsOnId: string;
      imageUrl: string | undefined;
      phone: string;
      moveInDate: string | undefined;
    }> = [];

    for (const row of collected.slice(0, limit)) {
      const tenant = await ctx.db.get(row.tenantUserId);
      out.push({
        applicationId: row.applicationId,
        legalNameAsOnId: row.legalNameAsOnId,
        imageUrl: tenant?.imageUrl,
        phone: row.phone,
        moveInDate: row.moveInDate,
      });
    }

    return { items: out };
  },
});
