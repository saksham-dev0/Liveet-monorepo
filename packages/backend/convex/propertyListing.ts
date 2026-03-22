import type { MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const MAX_LISTING_GALLERY = 10;

/** First listing image → cover; rest → galleryImageFileIds (order preserved). */
async function syncPropertyCoverAndGalleryFromListingItems(
  ctx: MutationCtx,
  propertyId: Id<"properties">,
) {
  const rows = await ctx.db
    .query("propertyListingGalleryItems")
    .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
    .collect();
  rows.sort((a, b) => a.sortOrder - b.sortOrder);

  if (rows.length === 0) {
    await ctx.db.patch(propertyId, {
      coverImageFileId: undefined,
      galleryImageFileIds: undefined,
    });
    return;
  }

  const fileIds = rows.map((r) => r.fileId);
  await ctx.db.patch(propertyId, {
    coverImageFileId: fileIds[0],
    galleryImageFileIds: fileIds.length > 1 ? fileIds.slice(1) : undefined,
  });
}

async function getCurrentUserDoc(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
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
    throw new Error("User not found");
  }

  return existing;
}

async function assertPropertyOwnerAndOnboarding(
  ctx: MutationCtx,
  propertyId: Id<"properties">,
) {
  const user = await getCurrentUserDoc(ctx);
  if (!user.hasCompletedOnboarding) {
    throw new Error("Complete onboarding before editing listing details.");
  }
  const property = await ctx.db.get("properties", propertyId);
  if (!property) {
    throw new Error("Property not found");
  }
  if (property.userId !== user._id) {
    throw new Error("You do not have access to this property");
  }
  return { user, property };
}

export const generateListingGalleryUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user.hasCompletedOnboarding) {
      throw new Error("Complete onboarding before uploading listing photos.");
    }
    const url = await ctx.storage.generateUploadUrl();
    return { uploadUrl: url };
  },
});

export const addListingGalleryItem = mutation({
  args: {
    propertyId: v.id("properties"),
    fileId: v.id("_storage"),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertPropertyOwnerAndOnboarding(ctx, args.propertyId);

    const existing = await ctx.db
      .query("propertyListingGalleryItems")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .collect();

    if (existing.length >= MAX_LISTING_GALLERY) {
      throw new Error(`You can upload at most ${MAX_LISTING_GALLERY} images.`);
    }

    const maxOrder = existing.reduce(
      (m, row) => Math.max(m, row.sortOrder),
      -1,
    );

    const id = await ctx.db.insert("propertyListingGalleryItems", {
      propertyId: args.propertyId,
      fileId: args.fileId,
      description: args.description,
      sortOrder: maxOrder + 1,
    });
    await syncPropertyCoverAndGalleryFromListingItems(ctx, args.propertyId);
    return id;
  },
});

export const updateListingGalleryItemDescription = mutation({
  args: {
    itemId: v.id("propertyListingGalleryItems"),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user.hasCompletedOnboarding) {
      throw new Error("Complete onboarding first.");
    }
    const item = await ctx.db.get("propertyListingGalleryItems", args.itemId);
    if (!item) {
      throw new Error("Image not found");
    }
    const property = await ctx.db.get("properties", item.propertyId);
    if (!property || property.userId !== user._id) {
      throw new Error("You do not have access to this image");
    }
    await ctx.db.patch(args.itemId, {
      description: args.description,
    });
  },
});

export const removeListingGalleryItem = mutation({
  args: { itemId: v.id("propertyListingGalleryItems") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user.hasCompletedOnboarding) {
      throw new Error("Complete onboarding first.");
    }
    const item = await ctx.db.get("propertyListingGalleryItems", args.itemId);
    if (!item) {
      throw new Error("Image not found");
    }
    const property = await ctx.db.get("properties", item.propertyId);
    if (!property || property.userId !== user._id) {
      throw new Error("You do not have access to this image");
    }
    await ctx.storage.delete(item.fileId);
    const propertyId = item.propertyId;
    await ctx.db.delete(args.itemId);
    await syncPropertyCoverAndGalleryFromListingItems(ctx, propertyId);
  },
});

export const setListingUtilitiesAndAmenities = mutation({
  args: {
    utilities: v.optional(v.array(v.string())),
    amenities: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user.hasCompletedOnboarding) {
      throw new Error("Complete onboarding before editing listing details.");
    }

    const property = await ctx.db
      .query("properties")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!property) {
      throw new Error("Property not found. Complete property basics first.");
    }

    await ctx.db.patch(property._id, {
      ...(args.utilities !== undefined ? { utilities: args.utilities } : {}),
      ...(args.amenities !== undefined ? { amenities: args.amenities } : {}),
    });
  },
});
