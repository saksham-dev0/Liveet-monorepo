import type { QueryCtx } from "./_generated/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

async function getCurrentUserDoc(ctx: any) {
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
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", tokenIdentifier),
    )
    .unique();

  if (existing) return existing;

  const userId = await ctx.db.insert("users", {
    tokenIdentifier,
    clerkUserId: identity.subject,
    email: identity.email,
    name: identity.name,
    imageUrl: identity.pictureUrl,
    role: "operator",
    hasCompletedOnboarding: false,
  });

  return await ctx.db.get(userId);
}

/** Prefer `primaryPropertyId` when valid so listing matches the user's main property. */
async function getOperatorPropertyForUser(
  ctx: QueryCtx,
  user: Doc<"users">,
): Promise<Doc<"properties"> | null> {
  if (user.primaryPropertyId) {
    const primary = await ctx.db.get("properties", user.primaryPropertyId);
    if (primary && primary.userId === user._id) {
      return primary;
    }
  }
  return await ctx.db
    .query("properties")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
}

async function getOnboardingStatusPayload(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const tokenIdentifier = identity.tokenIdentifier;
  if (!tokenIdentifier) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", tokenIdentifier),
    )
    .unique();

  if (!user) return null;

  const onboardingProfile = await ctx.db
    .query("onboardingProfiles")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();

  const businessProfile = await ctx.db
    .query("businessProfiles")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();

  const account = await ctx.db
    .query("accounts")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();

  const property = await getOperatorPropertyForUser(ctx, user);

  const agreement =
    property &&
    (await ctx.db
      .query("propertyAgreement")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .unique());

  const rent =
    property &&
    (await ctx.db
      .query("propertyRent")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .unique());

  const extraCharges =
    property &&
    (await ctx.db
      .query("propertyExtraCharges")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .unique());

  const tenantDetails =
    property &&
    (await ctx.db
      .query("propertyTenantDetails")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .unique());

  const roomOptions =
    property &&
    (await ctx.db
      .query("roomOptions")
      .withIndex("by_property_and_category", (q) =>
        q.eq("propertyId", property._id),
      )
      .collect());

  const floors =
    property &&
    (await ctx.db
      .query("floors")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .collect());

  const rooms =
    property &&
    (await ctx.db
      .query("rooms")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .collect());

  return {
    userId: user._id,
    user,
    hasCompletedOnboarding: !!user.hasCompletedOnboarding,
    primaryPropertyId: user.primaryPropertyId ?? null,
    referralCode: user.referralCode ?? null,
    onboardingProfile,
    businessProfile,
    account,
    property,
    agreement,
    rent,
    extraCharges,
    tenantDetails,
    roomOptions,
    floors,
    rooms,
  };
}

export const getOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    return await getOnboardingStatusPayload(ctx);
  },
});

export const getPropertyListingEditorData = query({
  args: {},
  handler: async (ctx) => {
    const bundle = await getOnboardingStatusPayload(ctx);
    if (!bundle) return null;

    const property = bundle.property;
    let coverImageUrl: string | null = null;
    const galleryImageUrls: (string | null)[] = [];

    const listingGallery: Array<
      Doc<"propertyListingGalleryItems"> & { url: string | null }
    > = [];

    if (property) {
      if (property.coverImageFileId) {
        coverImageUrl = await ctx.storage.getUrl(property.coverImageFileId);
      }
      const galleryIds = property.galleryImageFileIds ?? [];
      for (const fileId of galleryIds) {
        galleryImageUrls.push(await ctx.storage.getUrl(fileId));
      }

      const listingItems = await ctx.db
        .query("propertyListingGalleryItems")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .collect();
      listingItems.sort((a, b) => a.sortOrder - b.sortOrder);
      for (const item of listingItems) {
        listingGallery.push({
          ...item,
          url: await ctx.storage.getUrl(item.fileId),
        });
      }
    }

    /** Matches list-property checklist: at least one listing gallery photo; utilities; amenities. Captions optional. */
    let listingChecklistComplete = false;
    if (bundle.hasCompletedOnboarding && property) {
      const utilities = (property.utilities ?? []).map((u) => u.trim()).filter(Boolean);
      const amenities = (property.amenities ?? []).map((a) => a.trim()).filter(Boolean);
      const galleryOk = listingGallery.length > 0;
      listingChecklistComplete =
        utilities.length > 0 && amenities.length > 0 && galleryOk;
    }

    return {
      ...bundle,
      coverImageUrl,
      galleryImageUrls,
      listingGallery,
      listingChecklistComplete,
    };
  },
});

export const upsertPersonalDetails = mutation({
  args: {
    fullName: v.string(),
    brandName: v.optional(v.string()),
    totalUnits: v.optional(v.number()),
    totalProperties: v.optional(v.number()),
    operatingCityIds: v.optional(v.array(v.id("cities"))),
    preferredLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);

    const existing = await ctx.db
      .query("onboardingProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const base = {
      userId: user._id,
      fullName: args.fullName,
      brandName: args.brandName,
      totalUnits: args.totalUnits,
      totalProperties: args.totalProperties,
      operatingCityIds: args.operatingCityIds,
      preferredLanguage: args.preferredLanguage,
      status: "draft",
    } as const;

    if (!existing) {
      await ctx.db.insert("onboardingProfiles", base);
    } else {
      await ctx.db.patch(existing._id, base);
    }

    await ctx.db.patch(user._id, {
      name: args.fullName,
      brandName: args.brandName,
      preferredLanguage: args.preferredLanguage,
    });
  },
});

export const upsertBusinessDetails = mutation({
  args: {
    isRegistered: v.boolean(),
    businessType: v.optional(v.string()),
    registeredName: v.optional(v.string()),
    registeredAddress: v.optional(v.string()),
    registrationDocType: v.optional(v.string()),
    registrationNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);

    const existing = await ctx.db
      .query("businessProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const base = {
      userId: user._id,
      isRegistered: args.isRegistered,
      businessType: args.businessType,
      registeredName: args.registeredName,
      registeredAddress: args.registeredAddress,
      registrationDocType: args.registrationDocType,
      registrationNumber: args.registrationNumber,
    } as const;

    if (!existing) {
      await ctx.db.insert("businessProfiles", base);
    } else {
      await ctx.db.patch(existing._id, base);
    }
  },
});

export const setRegistrationProofFiles = mutation({
  args: {
    frontFileId: v.optional(v.id("_storage")),
    backFileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);

    const existing = await ctx.db
      .query("businessProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!existing) {
      throw new Error("Business profile must be created before attaching files");
    }

    await ctx.db.patch(existing._id, {
      registrationFrontFileId: args.frontFileId,
      registrationBackFileId: args.backFileId,
    });
  },
});

export const generateRegistrationUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getCurrentUserDoc(ctx);
    const url = await ctx.storage.generateUploadUrl();
    return { uploadUrl: url };
  },
});

export const generateAccountUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getCurrentUserDoc(ctx);
    const url = await ctx.storage.generateUploadUrl();
    return { uploadUrl: url };
  },
});

export const generatePropertyImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getCurrentUserDoc(ctx);
    const url = await ctx.storage.generateUploadUrl();
    return { uploadUrl: url };
  },
});

export const setUpiQrCodeFile = mutation({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);
    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!existing) {
      throw new Error("Account must exist before setting UPI QR code");
    }
    await ctx.db.patch(existing._id, { upiQrCodeFileId: args.fileId });
  },
});

export const upsertAccount = mutation({
  args: {
    accountType: v.string(),
    accountHolderName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    ifscCode: v.optional(v.string()),
    address: v.optional(v.string()),
    upiId: v.optional(v.string()),
    isSkipped: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);

    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const base = {
      userId: user._id,
      accountType: args.accountType,
      accountHolderName: args.accountHolderName,
      accountNumber: args.accountNumber,
      ifscCode: args.ifscCode,
      address: args.address,
      upiId: args.upiId,
      isSkipped: args.isSkipped,
    } as const;

    if (!existing) {
      await ctx.db.insert("accounts", base);
    } else {
      await ctx.db.patch(existing._id, base);
    }
  },
});

export const createOrUpdatePropertyBasics = mutation({
  args: {
    propertyId: v.optional(v.id("properties")),
    name: v.optional(v.string()),
    totalUnits: v.optional(v.number()),
    vacantUnits: v.optional(v.number()),
    pincode: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    line1: v.optional(v.string()),
    description: v.optional(v.string()),
    coverImageFileId: v.optional(v.id("_storage")),
    galleryImageFileIds: v.optional(v.array(v.id("_storage"))),
    amenities: v.optional(v.array(v.string())),
    nearbyPlaces: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);

    let propertyId = args.propertyId ?? null;
    if (propertyId) {
      const existing = await ctx.db.get(propertyId);
      if (!existing) {
        propertyId = null;
      } else if (existing.userId !== user._id) {
        throw new Error("You do not have access to this property");
      }
    }

    const optionalMedia = {
      ...(args.coverImageFileId !== undefined
        ? { coverImageFileId: args.coverImageFileId }
        : {}),
      ...(args.galleryImageFileIds !== undefined
        ? { galleryImageFileIds: args.galleryImageFileIds }
        : {}),
      ...(args.amenities !== undefined ? { amenities: args.amenities } : {}),
      ...(args.nearbyPlaces !== undefined
        ? { nearbyPlaces: args.nearbyPlaces }
        : {}),
    };

    if (!propertyId) {
      propertyId = await ctx.db.insert("properties", {
        userId: user._id,
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.totalUnits !== undefined ? { totalUnits: args.totalUnits } : {}),
        ...(args.vacantUnits !== undefined ? { vacantUnits: args.vacantUnits } : {}),
        ...(args.pincode !== undefined ? { pincode: args.pincode } : {}),
        ...(args.city !== undefined ? { city: args.city } : {}),
        ...(args.state !== undefined ? { state: args.state } : {}),
        ...(args.line1 !== undefined ? { line1: args.line1 } : {}),
        ...(args.description !== undefined ? { description: args.description } : {}),
        ...optionalMedia,
      });
      if (!user.primaryPropertyId) {
        await ctx.db.patch(user._id, { primaryPropertyId: propertyId });
      }
    } else {
      // Never pass `undefined` into db.patch — Convex removes those fields from the document.
      await ctx.db.patch(propertyId, {
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.totalUnits !== undefined ? { totalUnits: args.totalUnits } : {}),
        ...(args.vacantUnits !== undefined ? { vacantUnits: args.vacantUnits } : {}),
        ...(args.pincode !== undefined ? { pincode: args.pincode } : {}),
        ...(args.city !== undefined ? { city: args.city } : {}),
        ...(args.state !== undefined ? { state: args.state } : {}),
        ...(args.line1 !== undefined ? { line1: args.line1 } : {}),
        ...(args.description !== undefined ? { description: args.description } : {}),
        ...optionalMedia,
      });
    }

    return { propertyId };
  },
});

export const updateTenantDetails = mutation({
  args: {
    propertyId: v.id("properties"),
    canStayMale: v.optional(v.boolean()),
    canStayFemale: v.optional(v.boolean()),
    canStayOthers: v.optional(v.boolean()),
    bestForStudent: v.optional(v.boolean()),
    bestForWorkingProfessional: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await getCurrentUserDoc(ctx);

    const existing = await ctx.db
      .query("propertyTenantDetails")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .unique();

    const base = {
      propertyId: args.propertyId,
      canStayMale: args.canStayMale,
      canStayFemale: args.canStayFemale,
      canStayOthers: args.canStayOthers,
      bestForStudent: args.bestForStudent,
      bestForWorkingProfessional: args.bestForWorkingProfessional,
    } as const;

    if (!existing) {
      await ctx.db.insert("propertyTenantDetails", base);
    } else {
      await ctx.db.patch(existing._id, base);
    }
  },
});

const BEDS_PER_CATEGORY: Record<string, number> = {
  single: 1,
  double: 2,
  triple: 3,
  "3plus": 4,
};

function bedsForOption(category: string, numberOfRooms: number): number {
  const beds = BEDS_PER_CATEGORY[category] ?? 1;
  return numberOfRooms * beds;
}

export const addRoomOption = mutation({
  args: {
    propertyId: v.id("properties"),
    category: v.string(),
    numberOfRooms: v.optional(v.number()),
    typeName: v.optional(v.string()),
    rentAmount: v.optional(v.number()),
    attachedWashroom: v.optional(v.boolean()),
    attachedBalcony: v.optional(v.boolean()),
    airConditioner: v.optional(v.boolean()),
    geyser: v.optional(v.boolean()),
    customFeatures: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await getCurrentUserDoc(ctx);

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    const totalUnits = property.totalUnits ?? 0;
    if (totalUnits <= 0) {
      throw new Error("Please set total units in basic details first.");
    }

    const existingOptions = await ctx.db
      .query("roomOptions")
      .withIndex("by_property_and_category", (q) =>
        q.eq("propertyId", args.propertyId),
      )
      .collect();

    const bedsUsed = existingOptions.reduce(
      (sum, opt) =>
        sum + bedsForOption(opt.category, opt.numberOfRooms ?? 1),
      0,
    );

    const numRooms = args.numberOfRooms ?? 1;
    if (numRooms < 1 || !Number.isInteger(numRooms)) {
      throw new Error("Number of rooms must be at least 1.");
    }
    const newBeds = bedsForOption(args.category, numRooms);
    if (bedsUsed + newBeds > totalUnits) {
      const bedsRemaining = totalUnits - bedsUsed;
      const maxRooms =
        BEDS_PER_CATEGORY[args.category] != null
          ? Math.floor(bedsRemaining / (BEDS_PER_CATEGORY[args.category] ?? 1))
          : 0;
      throw new Error(
        `Total beds would exceed ${totalUnits} units. You can add at most ${maxRooms} room(s) of this type (${bedsRemaining} beds remaining).`,
      );
    }

    const id = await ctx.db.insert("roomOptions", {
      propertyId: args.propertyId,
      category: args.category,
      numberOfRooms: numRooms,
      typeName: args.typeName,
      rentAmount: args.rentAmount,
      attachedWashroom: args.attachedWashroom,
      attachedBalcony: args.attachedBalcony,
      airConditioner: args.airConditioner,
      geyser: args.geyser,
      customFeatures: args.customFeatures,
    });
    return { roomOptionId: id };
  },
});

export const updateRoomOption = mutation({
  args: {
    roomOptionId: v.id("roomOptions"),
    numberOfRooms: v.optional(v.number()),
    typeName: v.optional(v.string()),
    rentAmount: v.optional(v.number()),
    attachedWashroom: v.optional(v.boolean()),
    attachedBalcony: v.optional(v.boolean()),
    airConditioner: v.optional(v.boolean()),
    geyser: v.optional(v.boolean()),
    customFeatures: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await getCurrentUserDoc(ctx);
    const existing = await ctx.db.get(args.roomOptionId);
    if (!existing) throw new Error("Room option not found");
    const propertyId = existing.propertyId;
    const property = await ctx.db.get(propertyId);
    if (!property) throw new Error("Property not found");
    const totalUnits = property.totalUnits ?? 0;
    if (totalUnits <= 0) {
      throw new Error("Please set total units in basic details first.");
    }

    const allOptions = await ctx.db
      .query("roomOptions")
      .withIndex("by_property_and_category", (q) =>
        q.eq("propertyId", propertyId),
      )
      .collect();

    const bedsWithoutThis = allOptions
      .filter((opt) => opt._id !== args.roomOptionId)
      .reduce(
        (sum, opt) =>
          sum + bedsForOption(opt.category, opt.numberOfRooms ?? 1),
        0,
      );

    const numRooms = args.numberOfRooms ?? existing.numberOfRooms ?? 1;
    if (numRooms < 1 || !Number.isInteger(numRooms)) {
      throw new Error("Number of rooms must be at least 1.");
    }
    const newBeds = bedsForOption(existing.category, numRooms);
    if (bedsWithoutThis + newBeds > totalUnits) {
      const bedsRemaining = totalUnits - bedsWithoutThis;
      const maxRooms =
        BEDS_PER_CATEGORY[existing.category] != null
          ? Math.floor(
              bedsRemaining / (BEDS_PER_CATEGORY[existing.category] ?? 1),
            )
          : 0;
      throw new Error(
        `Total beds would exceed ${totalUnits} units. You can set at most ${maxRooms} room(s) for this option (${bedsRemaining} beds remaining).`,
      );
    }

    await ctx.db.patch(args.roomOptionId, {
      numberOfRooms: numRooms,
      ...(args.typeName !== undefined && { typeName: args.typeName }),
      ...(args.rentAmount !== undefined && { rentAmount: args.rentAmount }),
      ...(args.attachedWashroom !== undefined && {
        attachedWashroom: args.attachedWashroom,
      }),
      ...(args.attachedBalcony !== undefined && {
        attachedBalcony: args.attachedBalcony,
      }),
      ...(args.airConditioner !== undefined && {
        airConditioner: args.airConditioner,
      }),
      ...(args.geyser !== undefined && { geyser: args.geyser }),
      ...(args.customFeatures !== undefined && {
        customFeatures: args.customFeatures,
      }),
    });
  },
});

export const deleteRoomOption = mutation({
  args: { roomOptionId: v.id("roomOptions") },
  handler: async (ctx, args) => {
    await getCurrentUserDoc(ctx);
    await ctx.db.delete(args.roomOptionId);
  },
});

export const upsertAgreementDetails = mutation({
  args: {
    propertyId: v.id("properties"),
    securityDepositDuration: v.optional(v.string()),
    agreementDuration: v.optional(v.string()),
    lockInPeriod: v.optional(v.string()),
    noticePeriod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getCurrentUserDoc(ctx);
    const existing = await ctx.db
      .query("propertyAgreement")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .unique();

    const base = {
      propertyId: args.propertyId,
      securityDepositDuration: args.securityDepositDuration,
      agreementDuration: args.agreementDuration,
      lockInPeriod: args.lockInPeriod,
      noticePeriod: args.noticePeriod,
    } as const;

    if (!existing) {
      await ctx.db.insert("propertyAgreement", base);
    } else {
      await ctx.db.patch(existing._id, base);
    }
  },
});

export const upsertRentDetails = mutation({
  args: {
    propertyId: v.id("properties"),
    monthlyRentalCycle: v.optional(v.string()),
    gracePeriodDays: v.optional(v.number()),
    hasLateFee: v.optional(v.boolean()),
    lateFeeAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getCurrentUserDoc(ctx);
    const existing = await ctx.db
      .query("propertyRent")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .unique();

    const base = {
      propertyId: args.propertyId,
      monthlyRentalCycle: args.monthlyRentalCycle,
      gracePeriodDays: args.gracePeriodDays,
      hasLateFee: args.hasLateFee,
      lateFeeAmount: args.lateFeeAmount,
    } as const;

    if (!existing) {
      await ctx.db.insert("propertyRent", base);
    } else {
      await ctx.db.patch(existing._id, base);
    }
  },
});

export const upsertExtraCharges = mutation({
  args: {
    propertyId: v.id("properties"),
    isChargingExtra: v.optional(v.boolean()),
    type: v.optional(v.string()),
    amount: v.optional(v.number()),
    repetition: v.optional(v.string()),
    gracePeriodDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getCurrentUserDoc(ctx);
    const existing = await ctx.db
      .query("propertyExtraCharges")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .unique();

    const base = {
      propertyId: args.propertyId,
      isChargingExtra: args.isChargingExtra,
      type: args.type,
      amount: args.amount,
      repetition: args.repetition,
      gracePeriodDays: args.gracePeriodDays,
    } as const;

    if (!existing) {
      await ctx.db.insert("propertyExtraCharges", base);
    } else {
      await ctx.db.patch(existing._id, base);
    }
  },
});

export const addFloorWithRooms = mutation({
  args: {
    propertyId: v.id("properties"),
    floorNumber: v.number(),
    roomOptionId: v.optional(v.id("roomOptions")),
    category: v.optional(v.string()),
    numberOfRooms: v.number(),
  },
  handler: async (ctx, args) => {
    await getCurrentUserDoc(ctx);
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");

    const totalUnits = property.totalUnits ?? 0;
    if (totalUnits <= 0) {
      throw new Error("Set total units in property basic details first.");
    }

    const allRoomsForProperty = await ctx.db
      .query("rooms")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .collect();
    const currentCount = allRoomsForProperty.length;
    if (currentCount + args.numberOfRooms > totalUnits) {
      const remaining = totalUnits - currentCount;
      throw new Error(
        `Total units limit reached (${totalUnits}). You can add at most ${remaining} more room${remaining !== 1 ? "s" : ""}.`,
      );
    }

    const existing = await ctx.db
      .query("floors")
      .withIndex("by_property_and_floor", (q) =>
        q.eq("propertyId", args.propertyId).eq("floorNumber", args.floorNumber),
      )
      .unique();

    const floorId = existing
      ? existing._id
      : await ctx.db.insert("floors", {
          propertyId: args.propertyId,
          floorNumber: args.floorNumber,
          label:
            args.floorNumber === 0
              ? "Ground floor"
              : `Floor ${args.floorNumber}`,
        });

    const prefix = args.floorNumber * 100;
    const existingRooms = await ctx.db
      .query("rooms")
      .withIndex("by_floor", (q) => q.eq("floorId", floorId))
      .collect();
    const startIndex = existingRooms.length;

    const roomIds: string[] = [];
    for (let i = 0; i < args.numberOfRooms; i++) {
      const num = prefix + startIndex + i + 1;
      const roomNumber = String(num).padStart(3, "0");
      const id = await ctx.db.insert("rooms", {
        propertyId: args.propertyId,
        floorId,
        roomOptionId: args.roomOptionId,
        roomNumber,
        category: args.category,
      });
      roomIds.push(id);
    }

    return { floorId, roomIds };
  },
});

export const updateRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    roomNumber: v.optional(v.string()),
    displayName: v.optional(v.string()),
    roomOptionId: v.optional(v.id("roomOptions")),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getCurrentUserDoc(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    await ctx.db.patch(args.roomId, {
      ...(args.roomNumber !== undefined && { roomNumber: args.roomNumber }),
      ...(args.displayName !== undefined && { displayName: args.displayName }),
      ...(args.roomOptionId !== undefined && { roomOptionId: args.roomOptionId }),
      ...(args.category !== undefined && { category: args.category }),
    });
  },
});

export const deleteRoom = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    await getCurrentUserDoc(ctx);
    await ctx.db.delete(args.roomId);
  },
});

export const deleteFloor = mutation({
  args: { floorId: v.id("floors") },
  handler: async (ctx, args) => {
    await getCurrentUserDoc(ctx);
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_floor", (q) => q.eq("floorId", args.floorId))
      .collect();
    for (const room of rooms) {
      await ctx.db.delete(room._id);
    }
    await ctx.db.delete(args.floorId);
  },
});

export const getFloorConfig = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    await getCurrentUserDoc(ctx);
    const floors = await ctx.db
      .query("floors")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .collect();

    const result = [];
    for (const floor of floors) {
      const rooms = await ctx.db
        .query("rooms")
        .withIndex("by_floor", (q) => q.eq("floorId", floor._id))
        .collect();
      result.push({ ...floor, rooms });
    }
    return result;
  },
});

export const setReferralCode = mutation({
  args: { referralCode: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);
    await ctx.db.patch(user._id, { referralCode: args.referralCode });
  },
});

export const completeOnboarding = mutation({
  args: {
    primaryPropertyId: v.optional(v.id("properties")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);

    await ctx.db.patch(user._id, {
      hasCompletedOnboarding: true,
      primaryPropertyId: args.primaryPropertyId ?? user.primaryPropertyId,
    });

    const profile = await ctx.db
      .query("onboardingProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (profile) {
      await ctx.db.patch(profile._id, { status: "completed" });
    }
  },
});

/**
 * Returns all data needed for the add-property multi-step flow for a
 * specific property (not necessarily the primary property).
 */
export const getPropertyFlowData = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return null;
    const property = await ctx.db.get(args.propertyId);
    if (!property || property.userId !== user._id) return null;

    const roomOptions = await ctx.db
      .query("roomOptions")
      .withIndex("by_property_and_category", (q) =>
        q.eq("propertyId", args.propertyId),
      )
      .collect();

    const floors = await ctx.db
      .query("floors")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .collect();

    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .collect();

    const tenantDetails = await ctx.db
      .query("propertyTenantDetails")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .unique();

    const agreement = await ctx.db
      .query("propertyAgreement")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .unique();

    const rent = await ctx.db
      .query("propertyRent")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .unique();

    const extraCharges = await ctx.db
      .query("propertyExtraCharges")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .unique();

    return { property, roomOptions, floors, rooms, tenantDetails, agreement, rent, extraCharges };
  },
});

/**
 * Returns a flat list of active room assignments for the operator's property,
 * including whether rent is currently due for each tenant.
 *
 * Rent-due logic:
 *   paidUntil = assignedAt + (1 initial month + sum of paid rentTransaction months)
 *   isRentDue  = now > paidUntil + gracePeriodDays
 */
export const listActiveRoomAssignments = query({
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

    const property = await getOperatorPropertyForUser(ctx, user);
    if (!property) return [];

    // Grace period from the property's rent settings (default 0 days)
    const propertyRent = await ctx.db
      .query("propertyRent")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .unique();
    const gracePeriodMs = (propertyRent?.gracePeriodDays ?? 0) * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const apps = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .collect();

    const result: Array<{
      roomId: string;
      hasPendingPayment: boolean;
      isRentDue: boolean;
    }> = [];

    for (const app of apps) {
      if (app.assignedRoomId == null || app.moveOutDate) continue;

      const hasPendingPayment = app.paymentStatus !== "paid";

      // Months covered: prepaid agreement months (if paid) + each paid rent transaction
      function parseDurationMonths(duration: string): number | null {
        const s = duration.trim().toLowerCase();
        const monthMatch = s.match(/^(\d+)\s*month/);
        if (monthMatch) return parseInt(monthMatch[1], 10);
        const yearMatch = s.match(/^(\d+)\s*year/);
        if (yearMatch) return parseInt(yearMatch[1], 10) * 12;
        return null;
      }
      const initialMonths = app.paymentStatus === "paid"
        ? (app.onboardingAgreementDuration
            ? (parseDurationMonths(app.onboardingAgreementDuration) ?? 1)
            : 1)
        : 0;
      const transactions = await ctx.db
        .query("rentTransactions")
        .withIndex("by_application", (q) => q.eq("applicationId", app._id))
        .collect();
      const extraMonths = transactions
        .filter((t) => t.status === "paid")
        .reduce((sum, t) => sum + t.months, 0);

      const totalPaidMonths = initialMonths + extraMonths;

      // paidUntil = assignedAt (or now if missing) + totalPaidMonths calendar months
      const startMs = app.assignedAt ?? now;
      const paidUntilDate = new Date(startMs);
      paidUntilDate.setMonth(paidUntilDate.getMonth() + totalPaidMonths);
      const isRentDue = now > paidUntilDate.getTime() + gracePeriodMs;

      result.push({
        roomId: app.assignedRoomId as string,
        hasPendingPayment,
        isRentDue,
      });
    }

    // Include imported tenants that have a room assigned and haven't linked yet
    const importedList = await ctx.db
      .query("importedTenants")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .collect();

    for (const it of importedList) {
      if (!it.roomId || it.linkedUserId) continue; // linkedUserId = already counted via tenantMoveInApplications

      const hasPendingPayment = it.paymentStatus !== "paid";

      // Compute isRentDue from moveInDate + agreementDuration
      let isRentDue = false;
      if (!hasPendingPayment) {
        const parsedMoveIn = (() => {
          if (!it.moveInDate) return null;
          const parts = it.moveInDate.trim().split("/");
          if (parts.length !== 3) return null;
          const [dd, mm, yyyy] = parts.map(Number);
          if (!Number.isInteger(dd) || !Number.isInteger(mm) || !Number.isInteger(yyyy)) return null;
          if (yyyy < 2000 || mm < 1 || mm > 12) return null;
          const isLeap = (yyyy % 4 === 0 && yyyy % 100 !== 0) || yyyy % 400 === 0;
          const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mm - 1];
          if (dd < 1 || dd > daysInMonth) return null;
          return Date.UTC(yyyy, mm - 1, dd);
        })();
        const startMs = parsedMoveIn ?? now;
        const months = typeof it.agreementDuration === "number" && it.agreementDuration > 0 ? it.agreementDuration : 1;
        const paidUntilDate = new Date(startMs);
        paidUntilDate.setMonth(paidUntilDate.getMonth() + months);
        isRentDue = now > paidUntilDate.getTime() + gracePeriodMs;
      }

      result.push({
        roomId: it.roomId as string,
        hasPendingPayment,
        isRentDue,
      });
    }

    return result;
  },
});

/**
 * Returns onboarded tenants for the operator's property who have no room assigned yet.
 */
export const listUnassignedTenants = query({
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

    const property = await getOperatorPropertyForUser(ctx, user);
    if (!property) return [];

    const apps = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .collect();

    const result: Array<{
      applicationId: string;
      tenantName: string;
      phone: string;
      email: string;
      moveInDate: string;
    }> = [];

    for (const app of apps) {
      if (app.status !== "onboarded") continue;
      if (app.assignedRoomId) continue;
      if (app.moveOutDate) continue;
      result.push({
        applicationId: app._id,
        tenantName: app.legalNameAsOnId ?? "Unknown",
        phone: app.phone ?? "",
        email: app.email ?? "",
        moveInDate: app.moveInDate ?? "",
      });
    }

    return result;
  },
});

/**
 * Assigns a room to an onboarded tenant.
 */
export const assignRoomToTenant = mutation({
  args: {
    applicationId: v.id("tenantMoveInApplications"),
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const operator = await getCurrentUserDoc(ctx);

    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    const property = await ctx.db.get(app.propertyId);
    if (!property || property.userId !== operator._id) {
      throw new Error("You do not have access to this application");
    }

    if (app.assignedRoomId) {
      throw new Error("Application already has a room assigned");
    }
    if (app.moveOutDate) {
      throw new Error("Cannot assign a room to a tenant who has moved out");
    }

    const room = await ctx.db.get(args.roomId);
    if (!room || room.propertyId !== property._id) {
      throw new Error("Room does not belong to this property");
    }

    // Compute capacity from room category (mirrors moveIn.ts roomCapacity helper)
    function roomCapacity(category?: string): number {
      if (category === "double") return 2;
      if (category === "triple") return 3;
      if (category === "3plus") return 4;
      return 1;
    }
    const cap = roomCapacity(room.category);

    // Count active occupants already assigned to this room
    const propertyApps = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .take(500);
    const activeOccupants = propertyApps.filter(
      (a) => a.assignedRoomId === args.roomId && !a.moveOutDate && a._id !== args.applicationId,
    ).length;

    if (activeOccupants >= cap) {
      throw new Error(
        `Room ${room.roomNumber} is already at full capacity (${activeOccupants}/${cap})`,
      );
    }

    await ctx.db.patch(args.applicationId, {
      assignedRoomId: args.roomId,
      assignedRoomNumber: room.roomNumber,
      assignedAt: Date.now(),
      ...(room.roomOptionId !== undefined ? { selectedRoomOptionId: room.roomOptionId } : {}),
    });

    return { success: true };
  },
});
