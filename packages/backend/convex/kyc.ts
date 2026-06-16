import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getAuthUser(ctx: any) {
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

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getAuthUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getKycStatus = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return null;

    const kyc = await ctx.db
      .query("tenantKyc")
      .withIndex("by_tenantId", (q: any) => q.eq("tenantId", args.tenantId))
      .unique();
    if (!kyc) return null;

    if (kyc.userId !== user._id && kyc.operatorId !== user._id) return null;

    const [frontUrl, backUrl, photoUrl] = await Promise.all([
      kyc.idProofFrontStorageId ? ctx.storage.getUrl(kyc.idProofFrontStorageId) : null,
      kyc.idProofBackStorageId ? ctx.storage.getUrl(kyc.idProofBackStorageId) : null,
      kyc.profilePhotoStorageId ? ctx.storage.getUrl(kyc.profilePhotoStorageId) : null,
    ]);

    return {
      ...kyc,
      idProofFrontUrl: frontUrl,
      idProofBackUrl: backUrl,
      profilePhotoUrl: photoUrl,
    };
  },
});

export const submitIdProof = mutation({
  args: {
    tenantId: v.id("tenants"),
    idProofType: v.string(),
    idProofNumber: v.string(),
    idProofFrontStorageId: v.string(),
    idProofBackStorageId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Tenant not found");

    const existing = await ctx.db
      .query("tenantKyc")
      .withIndex("by_tenantId", (q: any) => q.eq("tenantId", args.tenantId))
      .unique();

    if (existing) {
      if (existing.userId !== user._id) throw new Error("Unauthorized");
    } else {
      const booking = await ctx.db
        .query("bookingRequests")
        .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
        .filter((q: any) =>
          q.and(
            q.eq(q.field("propertyId"), tenant.propertyId),
            q.eq(q.field("status"), "accepted")
          )
        )
        .first();
      if (!booking) throw new Error("Unauthorized");
    }

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        idProofType: args.idProofType,
        idProofNumber: args.idProofNumber,
        idProofFrontStorageId: args.idProofFrontStorageId,
        idProofBackStorageId: args.idProofBackStorageId,
        idProofStatus: "pending",
        overallStatus: "pending",
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("tenantKyc", {
      tenantId: args.tenantId,
      propertyId: tenant.propertyId,
      operatorId: tenant.operatorId,
      userId: user._id,
      idProofType: args.idProofType,
      idProofNumber: args.idProofNumber,
      idProofFrontStorageId: args.idProofFrontStorageId,
      idProofBackStorageId: args.idProofBackStorageId,
      idProofStatus: "pending",
      overallStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const submitProfilePhoto = mutation({
  args: {
    tenantId: v.id("tenants"),
    legalName: v.string(),
    profilePhotoStorageId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Tenant not found");

    const existing = await ctx.db
      .query("tenantKyc")
      .withIndex("by_tenantId", (q: any) => q.eq("tenantId", args.tenantId))
      .unique();

    if (!existing) throw new Error("Submit ID proof first");
    if (existing.userId !== user._id) throw new Error("Unauthorized");

    await ctx.db.patch(existing._id, {
      legalName: args.legalName,
      profilePhotoStorageId: args.profilePhotoStorageId,
      profilePhotoStatus: "pending",
      overallStatus: "pending",
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

// Operator query — fetch KYC details for a specific tenant
export const getTenantKycForOperator = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return null;

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.operatorId !== user._id) return null;

    const kyc = await ctx.db
      .query("tenantKyc")
      .withIndex("by_tenantId", (q: any) => q.eq("tenantId", args.tenantId))
      .unique();
    if (!kyc) return null;

    const [frontUrl, backUrl, photoUrl] = await Promise.all([
      kyc.idProofFrontStorageId ? ctx.storage.getUrl(kyc.idProofFrontStorageId) : null,
      kyc.idProofBackStorageId ? ctx.storage.getUrl(kyc.idProofBackStorageId) : null,
      kyc.profilePhotoStorageId ? ctx.storage.getUrl(kyc.profilePhotoStorageId) : null,
    ]);

    return {
      ...kyc,
      idProofFrontUrl: frontUrl,
      idProofBackUrl: backUrl,
      profilePhotoUrl: photoUrl,
    };
  },
});

// Operator query — fetch all KYC records for their property
export const getAllKycForProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return [];

    const kycList = await ctx.db
      .query("tenantKyc")
      .withIndex("by_propertyId", (q: any) => q.eq("propertyId", args.propertyId))
      .collect();

    // Only return records belonging to this operator
    return kycList.filter((k: any) => k.operatorId === user._id);
  },
});

export const getPropertyDetailsForTenant = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return null;

    const hasAccess =
      (await ctx.db
        .query("bookingRequests")
        .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
        .filter((q: any) =>
          q.and(
            q.eq(q.field("propertyId"), args.propertyId),
            q.eq(q.field("status"), "accepted")
          )
        )
        .first()) ||
      (await ctx.db
        .query("tenantKyc")
        .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
        .filter((q: any) => q.eq(q.field("propertyId"), args.propertyId))
        .first());
    if (!hasAccess) return null;

    const property = await ctx.db.get(args.propertyId);
    if (!property) return null;

    const pdfUrl = property.agreementPdfId
      ? await ctx.storage.getUrl(property.agreementPdfId)
      : null;

    return {
      name: property.name,
      addressLine1: property.addressLine1 ?? null,
      city: property.city ?? null,
      state: property.state ?? null,
      pincode: property.pincode ?? null,
      agreementDuration: property.agreementDuration ?? null,
      noticePeriod: property.noticePeriod ?? null,
      roomPricings: property.roomPricings ?? [],
      additionalCharges: property.additionalCharges ?? [],
      agreementPdfId: property.agreementPdfId ?? null,
      agreementPdfUrl: pdfUrl,
    };
  },
});

export const submitAgreementSign = mutation({
  args: {
    tenantId: v.id("tenants"),
    digitalSignatureName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Tenant not found");

    const existing = await ctx.db
      .query("tenantKyc")
      .withIndex("by_tenantId", (q: any) => q.eq("tenantId", args.tenantId))
      .unique();

    if (!existing) throw new Error("Complete ID proof and profile photo first");
    if (existing.userId !== user._id) throw new Error("Unauthorized");
    if (!existing.idProofFrontStorageId || !existing.idProofBackStorageId)
      throw new Error("Complete ID proof first");
    if (!existing.profilePhotoStorageId)
      throw new Error("Complete profile photo first");

    const now = Date.now();
    await ctx.db.patch(existing._id, {
      digitalSignatureName: args.digitalSignatureName,
      agreementSignedAt: now,
      agreementStatus: "signed",
      overallStatus: "pending",
      updatedAt: now,
    });

    return existing._id;
  },
});

export const updateKycStatus = mutation({
  args: {
    kycId: v.id("tenantKyc"),
    field: v.union(
      v.literal("idProofStatus"),
      v.literal("profilePhotoStatus"),
      v.literal("agreementStatus")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("verified"),
      v.literal("rejected")
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);

    const kyc = await ctx.db.get(args.kycId);
    if (!kyc || kyc.operatorId !== user._id) throw new Error("Unauthorized");

    const update: Record<string, any> = {
      [args.field]: args.status,
      updatedAt: Date.now(),
    };

    const idOk = args.field === "idProofStatus" ? args.status === "verified" : kyc.idProofStatus === "verified";
    const photoOk = args.field === "profilePhotoStatus" ? args.status === "verified" : kyc.profilePhotoStatus === "verified";
    const agreeOk = args.field === "agreementStatus" ? args.status === "verified" : kyc.agreementStatus === "verified";

    if (idOk && photoOk && agreeOk) {
      update.overallStatus = "verified";
    } else if (kyc.idProofStatus || kyc.profilePhotoStatus || kyc.agreementStatus) {
      update.overallStatus = "pending";
    }

    await ctx.db.patch(args.kycId, update);
  },
});
