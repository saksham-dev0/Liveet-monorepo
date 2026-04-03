import { mutation, query } from "./_generated/server";
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
    selectedRoomOptionId: v.id("roomOptions"),
    paymentMethod: v.union(
      v.literal("Bank transfer"),
      v.literal("UPI"),
      v.literal("Cash"),
    ),
    paymentStatus: v.union(v.literal("paid"), v.literal("pending")),
    agreementAccepted: v.boolean(),
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
    const roomOption = await ctx.db.get(args.selectedRoomOptionId);
    if (!roomOption || roomOption.propertyId !== args.propertyId) {
      throw new Error("Selected room option is not available for this property.");
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
    if (!args.agreementAccepted) {
      throw new Error("Please agree to the rental agreement before submitting.");
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
      selectedRoomOptionId: args.selectedRoomOptionId,
      paymentMethod: args.paymentMethod,
      paymentStatus: args.paymentStatus,
      agreementAccepted: true,
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

export const hasPaidMoveInForTenant = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) {
      return { shouldShowDashboard: false };
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) {
      return { shouldShowDashboard: false };
    }

    const apps = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_tenant", (q) => q.eq("tenantUserId", user._id))
      .take(200);

    const shouldShowDashboard = apps.some((app) => app.paymentStatus === "paid");
    return { shouldShowDashboard };
  },
});

export const getTenantMoveInForProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) {
      return { hasApplication: false };
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) {
      return { hasApplication: false };
    }

    const application = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_tenant_and_property", (q) =>
        q.eq("tenantUserId", user._id).eq("propertyId", args.propertyId),
      )
      .unique();
    if (!application) {
      return { hasApplication: false };
    }
    return {
      hasApplication: true,
      status: application.status ?? null,
      paymentStatus: application.paymentStatus ?? null,
    };
  },
});

export const submitQuickMoveInRequest = mutation({
  args: {
    propertyId: v.id("properties"),
    name: v.string(),
    phone: v.string(),
    email: v.string(),
    dateOfBirth: v.string(),
    address: v.string(),
    moveInDate: v.string(),
    selectedRoomOptionId: v.optional(v.id("roomOptions")),
  },
  handler: async (ctx, args) => {
    const user = await requireTenantUser(ctx);

    const property = await ctx.db.get(args.propertyId);
    if (!property) {
      throw new Error("Property not found");
    }
    if (property.userId === user._id) {
      throw new Error("You cannot submit a move-in request for your own property.");
    }

    const name = args.name.trim();
    const phone = args.phone.trim();
    const email = args.email.trim();
    const dateOfBirth = args.dateOfBirth.trim();
    const address = args.address.trim();
    const moveInDate = args.moveInDate.trim();

    if (!name || !phone || !email || !dateOfBirth || !address || !moveInDate) {
      throw new Error("Please fill in all required fields.");
    }

    const existing = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_tenant_and_property", (q) =>
        q.eq("tenantUserId", user._id).eq("propertyId", args.propertyId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        legalNameAsOnId: name,
        phone,
        email,
        dateOfBirth,
        address,
        moveInDate,
        status: "quick_request",
        selectedRoomOptionId: args.selectedRoomOptionId,
      });
      return { applicationId: existing._id, updated: true };
    }

    const applicationId = await ctx.db.insert("tenantMoveInApplications", {
      tenantUserId: user._id,
      propertyId: args.propertyId,
      status: "quick_request",
      legalNameAsOnId: name,
      phone,
      email,
      dateOfBirth,
      address,
      moveInDate,
      selectedRoomOptionId: args.selectedRoomOptionId,
    });
    return { applicationId, updated: false };
  },
});

export const listTenantMoveInApplicationPropertyIds = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) {
      return { propertyIds: [] as string[] };
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) {
      return { propertyIds: [] as string[] };
    }

    const apps = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_tenant", (q) => q.eq("tenantUserId", user._id))
      .take(200);
    const propertyIds = [...new Set(apps.map((app) => app.propertyId))];
    return { propertyIds };
  },
});

async function requireOperatorUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.tokenIdentifier) throw new Error("Unauthenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) throw new Error("User not found");
  return user;
}

export const getApplicationForOnboarding = query({
  args: { applicationId: v.id("tenantMoveInApplications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return { notFound: true as const };

    const operator = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!operator) return { notFound: true as const };

    const app = await ctx.db.get(args.applicationId);
    if (!app) return { notFound: true as const };

    const property = await ctx.db.get(app.propertyId);
    if (!property || property.userId !== operator._id) return { notFound: true as const };

    const roomOptions = await ctx.db
      .query("roomOptions")
      .withIndex("by_property_and_category", (q) =>
        q.eq("propertyId", property._id),
      )
      .take(30);

    const apps = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .take(500);

    // Count active occupants per room (exclude moved-out tenants and this tenant)
    const occupancyMap = new Map<string, number>();
    for (const a of apps) {
      if (a.assignedRoomId && !a.moveOutDate && a._id !== args.applicationId) {
        occupancyMap.set(a.assignedRoomId, (occupancyMap.get(a.assignedRoomId) ?? 0) + 1);
      }
    }

    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .take(200);

    // Get the room category the tenant requested
    const selectedOption = app.selectedRoomOptionId
      ? await ctx.db.get(app.selectedRoomOptionId)
      : null;
    const requestedCategory = selectedOption?.category ?? null;

    function roomCapacity(category?: string): number {
      if (category === "double") return 2;
      if (category === "triple") return 3;
      return 1;
    }

    const availableRooms = rooms
      .filter((r) => {
        // Always show the room currently assigned to this tenant
        if (app.assignedRoomId === r._id) return true;
        // Filter by the tenant's requested room type
        if (requestedCategory && r.category !== requestedCategory) return false;
        // Show room only if it still has capacity
        const cap = roomCapacity(r.category);
        const count = occupancyMap.get(r._id) ?? 0;
        return count < cap;
      })
      .map((r) => {
        const cap = roomCapacity(r.category);
        const count = occupancyMap.get(r._id) ?? 0;
        const label =
          cap > 1 && count > 0
            ? `${r.roomNumber} (${count}/${cap} occupied)`
            : r.roomNumber;
        return { roomId: r._id, roomLabel: label };
      });

    return {
      notFound: false as const,
      applicationId: app._id,
      propertyId: property._id,
      propertyName: property.name?.trim() || "Unnamed property",
      tenantName: app.legalNameAsOnId ?? "",
      phone: app.phone ?? "",
      email: app.email ?? "",
      dateOfBirth: app.dateOfBirth ?? "",
      address: app.address ?? "",
      moveInDate: app.moveInDate ?? "",
      selectedRoomOptionLabel: selectedOption?.typeName ?? selectedOption?.category ?? null,
      selectedRentAmount: selectedOption?.rentAmount ?? null,
      assignedRoomId: app.assignedRoomId ?? null,
      assignedRoomNumber: app.assignedRoomNumber ?? null,
      onboardingSecurityDeposit: app.onboardingSecurityDeposit ?? null,
      onboardingAgreementDuration: app.onboardingAgreementDuration ?? null,
      onboardingRentCycle: app.onboardingRentCycle ?? null,
      onboardingRentCycleCustomDay: app.onboardingRentCycleCustomDay ?? null,
      onboardingExtraCharges: app.onboardingExtraCharges ?? null,
      roomOptions: roomOptions.map((o) => ({
        id: o._id,
        label: o.typeName?.trim() || o.category,
        rentAmount: o.rentAmount ?? null,
      })),
      availableRooms,
    };
  },
});

export const onboardTenant = mutation({
  args: {
    applicationId: v.id("tenantMoveInApplications"),
    roomId: v.optional(v.id("rooms")),
    securityDeposit: v.optional(v.number()),
    agreementDuration: v.optional(v.string()),
    rentCycle: v.optional(v.string()),
    rentCycleCustomDay: v.optional(v.number()),
    extraCharges: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operator = await requireOperatorUser(ctx);

    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    const property = await ctx.db.get(app.propertyId);
    if (!property || property.userId !== operator._id) {
      throw new Error("You do not have access to this application");
    }

    const patch: Record<string, unknown> = {
      status: "onboarded",
      onboardingSecurityDeposit: args.securityDeposit,
      onboardingAgreementDuration: args.agreementDuration,
      onboardingRentCycle: args.rentCycle,
      onboardingRentCycleCustomDay: args.rentCycleCustomDay,
      onboardingExtraCharges: args.extraCharges,
    };

    if (args.roomId) {
      const room = await ctx.db.get(args.roomId);
      if (!room || room.propertyId !== property._id) {
        throw new Error("Selected room does not belong to this property");
      }
      patch.assignedRoomId = args.roomId;
      patch.assignedRoomNumber = room.roomNumber;
      patch.assignedAt = Date.now();
    }

    await ctx.db.patch(args.applicationId, patch as any);

    // Send the onboarding invite message to the tenant via chat.
    const propertyName = property.name?.trim() || "this property";
    const messageBody = `__OB__:${JSON.stringify({
      pid: app.propertyId,
      aid: args.applicationId,
      pname: propertyName,
    })}`;

    let conv = await ctx.db
      .query("conversations")
      .withIndex("by_property_and_tenant", (q) =>
        q.eq("propertyId", app.propertyId).eq("tenantUserId", app.tenantUserId),
      )
      .unique();

    if (!conv) {
      const convId = await ctx.db.insert("conversations", {
        propertyId: app.propertyId,
        tenantUserId: app.tenantUserId,
        operatorUserId: operator._id,
        tenantUnreadCount: 0,
        operatorUnreadCount: 0,
      });
      conv = await ctx.db.get(convId);
    }

    if (conv) {
      await ctx.db.insert("messages", {
        conversationId: conv._id,
        senderUserId: operator._id,
        senderRole: "operator",
        body: messageBody,
      });
      await ctx.db.patch(conv._id, {
        lastMessageAt: Date.now(),
        lastMessageText: `Onboarding invite for ${propertyName}`,
        tenantUnreadCount: (conv.tenantUnreadCount ?? 0) + 1,
      });
    }

    return { success: true };
  },
});

export const completeKycAndPayment = mutation({
  args: {
    propertyId: v.id("properties"),
    govIdType: v.string(),
    govIdNumber: v.string(),
    idFrontFileId: v.optional(v.id("_storage")),
    maritalStatus: v.union(v.literal("married"), v.literal("single")),
    professionalDetails: v.string(),
    emergencyContacts: v.array(
      v.object({ name: v.string(), phone: v.string(), relation: v.string() }),
    ),
    selectedRoomOptionId: v.optional(v.id("roomOptions")),
    paymentMethod: v.union(
      v.literal("Bank transfer"),
      v.literal("UPI"),
      v.literal("Cash"),
    ),
    agreementAccepted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireTenantUser(ctx);

    if (!args.agreementAccepted) {
      throw new Error("Please accept the rental agreement before submitting.");
    }

    const govIdType = args.govIdType.trim();
    const govIdNumber = args.govIdNumber.trim();
    const professionalDetails = args.professionalDetails.trim();

    if (!govIdType || !govIdNumber || !professionalDetails) {
      throw new Error("Please fill in all required fields.");
    }

    const contacts = args.emergencyContacts
      .map((c) => ({
        name: c.name.trim(),
        phone: c.phone.trim(),
        relation: c.relation.trim(),
      }))
      .filter((c) => c.name && c.phone && c.relation);

    if (contacts.length === 0) {
      throw new Error("Please add at least one emergency contact.");
    }

    const existing = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_tenant_and_property", (q) =>
        q.eq("tenantUserId", user._id).eq("propertyId", args.propertyId),
      )
      .unique();

    const kyc: Record<string, unknown> = {
      govIdType,
      govIdNumber,
      maritalStatus: args.maritalStatus,
      professionalDetails,
      emergencyContacts: contacts,
      paymentMethod: args.paymentMethod,
      paymentStatus: "pending" as const,
      agreementAccepted: true,
      status: "submitted",
    };
    if (args.idFrontFileId) {
      kyc.idFrontFileId = args.idFrontFileId;
    }
    if (args.selectedRoomOptionId) {
      kyc.selectedRoomOptionId = args.selectedRoomOptionId;
    }

    if (existing) {
      await ctx.db.patch(existing._id, kyc as any);
      return { applicationId: existing._id };
    }

    // Should not normally reach here (quick request should already exist),
    // but create a new record as a fallback.
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");

    const applicationId = await ctx.db.insert("tenantMoveInApplications", {
      tenantUserId: user._id,
      propertyId: args.propertyId,
      ...(kyc as any),
    });
    return { applicationId };
  },
});
