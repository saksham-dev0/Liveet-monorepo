import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
async function requireTenantUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.tokenIdentifier) {
    throw new Error("Unauthenticated");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) {
    throw new Error("User not found. Sync your account and try again.");
  }
  return user;
}

function trimOrEmpty(s: string): string {
  return s.trim();
}

export const generateMoveInIdUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireTenantUser(ctx);
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

export const submitMoveInApplication = mutation({
  args: {
    propertyId: v.id("properties"),
    legalNameAsOnId: v.string(),
    govIdType: v.string(),
    govIdOtherLabel: v.optional(v.string()),
    govIdNumber: v.string(),
    idFrontFileId: v.id("_storage"),
    idBackFileId: v.id("_storage"),
    phone: v.string(),
    email: v.string(),
    dateOfBirth: v.string(),
    maritalStatus: v.union(v.literal("married"), v.literal("single")),
    address: v.string(),
    moveInDate: v.string(),
    professionalDetails: v.string(),
    emergencyContacts: v.array(
      v.object({
        name: v.string(),
        phone: v.string(),
        relation: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireTenantUser(ctx);

    const property = await ctx.db.get(args.propertyId);
    if (!property) {
      throw new Error("Property not found");
    }
    if (property.userId === user._id) {
      throw new Error("You cannot submit a move-in application for your own property.");
    }

    const swipe = await ctx.db
      .query("tenantPropertySwipes")
      .withIndex("by_tenant_and_property", (q) =>
        q.eq("tenantUserId", user._id).eq("propertyId", args.propertyId),
      )
      .unique();
    if (!swipe || !swipe.liked) {
      throw new Error("Like this property before submitting a move-in application.");
    }

    const legalNameAsOnId = trimOrEmpty(args.legalNameAsOnId);
    const govIdType = trimOrEmpty(args.govIdType);
    const govIdNumber = trimOrEmpty(args.govIdNumber);
    const phone = trimOrEmpty(args.phone);
    const email = trimOrEmpty(args.email);
    const dateOfBirth = trimOrEmpty(args.dateOfBirth);
    const address = trimOrEmpty(args.address);
    const moveInDate = trimOrEmpty(args.moveInDate);
    const professionalDetails = trimOrEmpty(args.professionalDetails);

    if (
      !legalNameAsOnId ||
      !govIdType ||
      !govIdNumber ||
      !phone ||
      !email ||
      !dateOfBirth ||
      !address ||
      !moveInDate ||
      !professionalDetails
    ) {
      throw new Error("Please complete all required fields.");
    }

    const govIdOtherLabel =
      govIdType === "Others" ? trimOrEmpty(args.govIdOtherLabel ?? "") : undefined;
    if (govIdType === "Others" && !govIdOtherLabel) {
      throw new Error("Describe the ID type when you select Others.");
    }

    const contacts = args.emergencyContacts
      .map((c) => ({
        name: trimOrEmpty(c.name),
        phone: trimOrEmpty(c.phone),
        relation: trimOrEmpty(c.relation),
      }))
      .filter((c) => c.name && c.phone && c.relation);

    const partial = args.emergencyContacts.some((c) => {
      const t = (x: string) => x.trim();
      const any = t(c.name) || t(c.phone) || t(c.relation);
      const all = t(c.name) && t(c.phone) && t(c.relation);
      return any && !all;
    });
    if (partial) {
      throw new Error(
        "Each emergency contact must include name, phone, and relation, or leave the row empty.",
      );
    }
    if (contacts.length === 0) {
      throw new Error("Add at least one complete emergency contact.");
    }

    const row = {
      tenantUserId: user._id,
      propertyId: args.propertyId,
      status: "submitted",
      legalNameAsOnId,
      govIdType,
      govIdOtherLabel:
        govIdOtherLabel && govIdOtherLabel.length > 0 ? govIdOtherLabel : undefined,
      govIdNumber,
      idFrontFileId: args.idFrontFileId,
      idBackFileId: args.idBackFileId,
      phone,
      email,
      dateOfBirth,
      maritalStatus: args.maritalStatus,
      address,
      moveInDate,
      professionalDetails,
      emergencyContacts: contacts,
    };

    const existing = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_tenant_and_property", (q) =>
        q.eq("tenantUserId", user._id).eq("propertyId", args.propertyId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, row);
      return { applicationId: existing._id, updated: true };
    }

    const applicationId = await ctx.db.insert("tenantMoveInApplications", row);
    return { applicationId, updated: false };
  },
});
