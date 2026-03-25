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
    let totalPaidRentAmount = 0;
    /** Tenants who completed E-KYC / move-in for any of this operator's properties (distinct users). */
    const occupantsWithKyc = new Set<Id<"users">>();
    const roomOptionCache = new Map<Id<"roomOptions">, Doc<"roomOptions"> | null>();

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

        if (app.paymentStatus !== "paid" || !app.selectedRoomOptionId) {
          continue;
        }

        const selectedRoomOptionId = app.selectedRoomOptionId;
        let roomOption = roomOptionCache.get(selectedRoomOptionId);
        if (roomOption === undefined) {
          roomOption = await ctx.db.get(selectedRoomOptionId);
          roomOptionCache.set(selectedRoomOptionId, roomOption);
        }
        if (!roomOption || roomOption.propertyId !== p._id) {
          continue;
        }
        if (
          typeof roomOption.rentAmount === "number" &&
          !Number.isNaN(roomOption.rentAmount) &&
          roomOption.rentAmount > 0
        ) {
          totalPaidRentAmount += roomOption.rentAmount;
        }
      }
    }

    return {
      vacantUnits,
      occupiedUnits,
      occupantsWithKyc: occupantsWithKyc.size,
      totalPaidRentAmount,
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

/** All tenants who completed move-in onboarding (E-KYC submitted) on this operator's properties — for Manage tab. */
export const listOnboardedTenantsForManage = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 200, 1), 300);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { items: [] };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      return { items: [] };
    }

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);

    type Collected = {
      _creationTime: number;
      applicationId: Id<"tenantMoveInApplications">;
      propertyId: Id<"properties">;
      propertyName: string;
      legalNameAsOnId: string;
      phone: string;
      moveInDate: string | undefined;
      tenantUserId: Id<"users">;
      paymentStatus: "paid" | "pending" | undefined;
    };

    const collected: Collected[] = [];

    for (const p of properties) {
      const propertyName = p.name?.trim() || "Unnamed property";
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
          propertyId: p._id,
          propertyName,
          legalNameAsOnId: app.legalNameAsOnId,
          phone: app.phone,
          moveInDate: app.moveInDate,
          tenantUserId: app.tenantUserId,
          paymentStatus: app.paymentStatus,
        });
      }
    }

    collected.sort((a, b) => b._creationTime - a._creationTime);

    const out: Array<{
      applicationId: Id<"tenantMoveInApplications">;
      propertyId: Id<"properties">;
      propertyName: string;
      legalNameAsOnId: string;
      imageUrl: string | undefined;
      phone: string;
      moveInDate: string | undefined;
      paymentStatus: "paid" | "pending" | undefined;
    }> = [];

    for (const row of collected.slice(0, limit)) {
      const tenant = await ctx.db.get(row.tenantUserId);
      out.push({
        applicationId: row.applicationId,
        propertyId: row.propertyId,
        propertyName: row.propertyName,
        legalNameAsOnId: row.legalNameAsOnId,
        imageUrl: tenant?.imageUrl,
        phone: row.phone,
        moveInDate: row.moveInDate,
        paymentStatus: row.paymentStatus,
      });
    }

    return { items: out };
  },
});

function roomOptionSummary(room: Doc<"roomOptions"> | null): string {
  if (!room) return "Room";
  const typeName = room.typeName?.trim();
  if (typeName) return typeName;
  const cat = room.category?.trim() ?? "";
  const n = room.numberOfRooms;
  if (cat && typeof n === "number" && n > 0) {
    return `${cat} · ${n} room${n === 1 ? "" : "s"}`;
  }
  return cat || "Room";
}

/** Single tenant manage view for an operator — auth + property ownership enforced. */
export const getTenantManageDetails = query({
  args: { applicationId: v.id("tenantMoveInApplications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) {
      return { notFound: true as const };
    }

    const operator = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!operator) {
      return { notFound: true as const };
    }

    const app = await ctx.db.get(args.applicationId);
    if (!app) {
      return { notFound: true as const };
    }

    const property = await ctx.db.get(app.propertyId);
    if (!property || property.userId !== operator._id) {
      return { notFound: true as const };
    }

    const tenantUser = await ctx.db.get(app.tenantUserId);
    const roomOption = app.selectedRoomOptionId
      ? await ctx.db.get(app.selectedRoomOptionId)
      : null;

    const agreement = await ctx.db
      .query("propertyAgreement")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .unique();

    const govDigits = (app.govIdNumber ?? "").replace(/\D/g, "");
    const idSuffix =
      govDigits.length >= 4 ? govDigits.slice(-4) : app.govIdNumber.trim();

    const roomLabel = roomOptionSummary(roomOption);
    const metaLine =
      idSuffix.length > 0 ? `${roomLabel} · ID: ${idSuffix}` : roomLabel;

    const steps = [
      {
        key: "contact",
        label: "Tenant contact & profile",
        done: Boolean(
          app.legalNameAsOnId?.trim() &&
            app.phone?.trim() &&
            app.email?.trim(),
        ),
      },
      {
        key: "payment",
        label: "Rent payment",
        done: app.paymentStatus === "paid",
      },
      {
        key: "agreement",
        label: "Rental agreement signed",
        done: app.agreementAccepted === true,
      },
      {
        key: "emergency",
        label: "Emergency contacts",
        done: (app.emergencyContacts?.length ?? 0) > 0,
      },
    ] as const;

    const totalSteps = steps.length;
    const completedCount = steps.filter((s) => s.done).length;
    const incompleteCount = totalSteps - completedCount;
    const percentRemaining = Math.round((incompleteCount / totalSteps) * 100);
    const segmentFilled = steps.map((s) => s.done);
    const firstIncomplete = steps.find((s) => !s.done);
    const currentTaskLabel = firstIncomplete
      ? firstIncomplete.label
      : "All steps complete";

    return {
      notFound: false as const,
      applicationId: app._id,
      propertyId: property._id,
      propertyName: property.name?.trim() || "Unnamed property",
      legalNameAsOnId: app.legalNameAsOnId,
      tenantImageUrl: tenantUser?.imageUrl,
      phone: app.phone,
      email: app.email,
      moveInDate: app.moveInDate,
      paymentStatus: app.paymentStatus,
      paymentMethod: app.paymentMethod,
      metaLine,
      agreementDuration: agreement?.agreementDuration,
      agreementLockIn: agreement?.lockInPeriod,
      checklist: {
        percentRemaining,
        completedCount,
        totalSteps,
        segmentFilled,
        currentTaskLabel,
        steps: steps.map((s) => ({ key: s.key, label: s.label, done: s.done })),
      },
    };
  },
});

/** Recent credited transactions for operator dashboard based on tenant move-ins. */
export const getRecentCreditedTransactionsForDashboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 8, 1), 25);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) {
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
    if (properties.length === 0) {
      return { items: [] as Array<never> };
    }

    const propertyIdSet = new Set(properties.map((p) => p._id));

    const paidApps: Doc<"tenantMoveInApplications">[] = [];
    for (const property of properties) {
      const apps = await ctx.db
        .query("tenantMoveInApplications")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .take(200);
      for (const app of apps) {
        if (app.paymentStatus === "paid" && app.selectedRoomOptionId) {
          paidApps.push(app);
        }
      }
    }

    const roomOptionCache = new Map<Id<"roomOptions">, Doc<"roomOptions"> | null>();

    const creditedRows: Array<{
      applicationId: Id<"tenantMoveInApplications">;
      _creationTime: number;
      tenantName: string;
      amount: number;
    }> = [];

    for (const app of paidApps) {
      const selectedRoomOptionId = app.selectedRoomOptionId;
      if (!selectedRoomOptionId) continue;

      let roomOption = roomOptionCache.get(selectedRoomOptionId);
      if (roomOption === undefined) {
        roomOption = await ctx.db.get(selectedRoomOptionId);
        roomOptionCache.set(selectedRoomOptionId, roomOption);
      }
      if (!roomOption) continue;
      if (!propertyIdSet.has(roomOption.propertyId)) continue;

      const category = roomOption.category?.trim().toLowerCase() ?? "";
      const typeName = roomOption.typeName?.trim().toLowerCase() ?? "";
      const isSingleSharing =
        category === "single" || typeName.includes("single sharing");
      if (!isSingleSharing) continue;

      const amount = roomOption.rentAmount;
      if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
        continue;
      }

      creditedRows.push({
        applicationId: app._id,
        _creationTime: app._creationTime,
        tenantName: app.legalNameAsOnId,
        amount,
      });
    }

    creditedRows.sort((a, b) => b._creationTime - a._creationTime);

    return {
      items: creditedRows.slice(0, limit).map((row) => ({
        applicationId: row.applicationId,
        tenantName: row.tenantName,
        amount: row.amount,
        createdAt: row._creationTime,
        type: "credit" as const,
      })),
    };
  },
});

/**
 * Recomputes each operator property's vacantUnits based on occupied tenants
 * (completed move-in applications), and persists the latest value.
 */
export const syncVacantUnitsForDashboard = mutation({
  args: {},
  handler: async (ctx) => {
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
      throw new Error("User not found");
    }

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);

    let updatedProperties = 0;

    for (const property of properties) {
      const totalUnits = property.totalUnits ?? 0;
      if (totalUnits <= 0) continue;

      const apps = await ctx.db
        .query("tenantMoveInApplications")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .take(500);

      const occupiedTenantIds = new Set<Id<"users">>();
      for (const app of apps) {
        if (isMoveInKycComplete(app)) {
          occupiedTenantIds.add(app.tenantUserId);
        }
      }

      const occupiedUnits = Math.min(totalUnits, occupiedTenantIds.size);
      const nextVacantUnits = Math.max(0, totalUnits - occupiedUnits);

      if (property.vacantUnits !== nextVacantUnits) {
        await ctx.db.patch(property._id, { vacantUnits: nextVacantUnits });
        updatedProperties += 1;
      }
    }

    return { updatedProperties };
  },
});
