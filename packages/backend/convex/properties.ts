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

/**
 * Returns true if the move-in date (DD/MM/YYYY) is strictly before today.
 * Unparseable or missing dates return false (i.e. keep the record).
 */
function isMoveInDatePast(moveInDate: string | undefined): boolean {
  if (!moveInDate?.trim()) return false;
  const parts = moveInDate.trim().split("/");
  if (parts.length !== 3) return false;
  const [dd, mm, yyyy] = parts;
  const d = parseInt(dd ?? "", 10);
  const m = parseInt(mm ?? "", 10) - 1;
  const y = parseInt(yyyy ?? "", 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return false;
  const moveInMs = new Date(y, m, d).getTime();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return moveInMs < todayStart.getTime();
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
        if (isMoveInDatePast(app.moveInDate)) {
          continue;
        }
        collected.push({
          _creationTime: app._creationTime,
          applicationId: app._id,
          legalNameAsOnId: app.legalNameAsOnId ?? "",
          phone: app.phone ?? "",
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
          legalNameAsOnId: app.legalNameAsOnId ?? "",
          phone: app.phone ?? "",
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

function parseMoveInDateToTs(
  moveInDate: string,
): { ts: number; formatted: string } | null {
  const s = moveInDate.trim();
  if (!s) return null;

  // Supports a few common input formats:
  // - YYYY-MM-DD
  // - DD/MM/YYYY
  // - DD-MM-YYYY
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const d = new Date(year, month - 1, day);
    return {
      ts: d.getTime(),
      formatted: `${String(day).padStart(2, "0")}/${String(month).padStart(
        2,
        "0",
      )}/${String(year)}`,
    };
  }

  const dmyMatch = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const d = new Date(year, month - 1, day);
    return {
      ts: d.getTime(),
      formatted: `${String(day).padStart(2, "0")}/${String(month).padStart(
        2,
        "0",
      )}/${String(year)}`,
    };
  }

  return null;
}

function dueLabelBeforeMoveIn(moveInDate?: string): {
  dueLabel: string;
  dueTs: number | null;
} {
  if (!moveInDate) {
    return { dueLabel: "Before move-in", dueTs: null };
  }
  const parsed = parseMoveInDateToTs(moveInDate);
  if (!parsed) {
    return { dueLabel: "Before move-in", dueTs: null };
  }

  // Create the due date 1 day before the move-in date.
  const due = new Date(parsed.ts - 24 * 60 * 60 * 1000);
  const dueDay = due.getDate();
  const dueMonth = due.getMonth() + 1;
  const dueYear = due.getFullYear();
  const formattedDue = `${String(dueDay).padStart(2, "0")}/${String(
    dueMonth,
  ).padStart(2, "0")}/${String(dueYear)}`;

  return { dueLabel: `Due by ${formattedDue}`, dueTs: due.getTime() };
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
      govDigits.length >= 4 ? govDigits.slice(-4) : (app.govIdNumber ?? "").trim();

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

      const amount = roomOption.rentAmount;
      if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
        continue;
      }

      creditedRows.push({
        applicationId: app._id,
        _creationTime: app._creationTime,
        tenantName: app.legalNameAsOnId ?? "",
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
      // No-op during client logout races (token cleared before UI unmounts).
      return { updatedProperties: 0 };
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

type RoomTaskPriority = "High" | "Medium" | "Low";

function priorityWeight(p: RoomTaskPriority): number {
  if (p === "High") return 0;
  if (p === "Medium") return 1;
  return 2;
}

export const getRoomAssignmentTasksForOperator = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) {
      return { items: [] as Array<{
        applicationId: Id<"tenantMoveInApplications">;
        priority: RoomTaskPriority;
        description: string;
        tenantName: string;
        dueLabel: string;
      }> };
    }

    const operator = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!operator) {
      return { items: [] as Array<{
        applicationId: Id<"tenantMoveInApplications">;
        priority: RoomTaskPriority;
        description: string;
        tenantName: string;
        dueLabel: string;
      }> };
    }

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_user", (q) => q.eq("userId", operator._id))
      .take(200);

    type InternalTask = {
      applicationId: Id<"tenantMoveInApplications">;
      priority: RoomTaskPriority;
      description: string;
      tenantName: string;
      dueLabel: string;
      _dueTs: number | null;
      _creationTime: number;
    };

    const collected: InternalTask[] = [];

    for (const property of properties) {
      const apps = await ctx.db
        .query("tenantMoveInApplications")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .take(300);

      for (const app of apps) {
        // Skip fully completed applications (room assigned AND payment received).
        if (app.assignedRoomId && app.paymentStatus === "paid") continue;

        const isQuickRequest = app.status === "quick_request";
        const isEkycSubmitted = app.status === "submitted";
        const isPaid = app.paymentStatus === "paid";

        if (isQuickRequest) {
          const due = dueLabelBeforeMoveIn(app.moveInDate);
          const tenantName = app.legalNameAsOnId?.trim() || "New user";
          collected.push({
            applicationId: app._id,
            priority: "High",
            description: "Move-in request by new user",
            tenantName,
            dueLabel: due.dueLabel,
            _dueTs: due.dueTs,
            _creationTime: app._creationTime,
          });
          if (collected.length >= limit) break;
          continue;
        }

        const due = dueLabelBeforeMoveIn(app.moveInDate);
        const tenantName = app.legalNameAsOnId?.trim() || "Tenant";
        const isCashOnReception =
          app.paymentMethod === "Cash" && app.paymentStatus !== "paid";

        if (isCashOnReception) {
          collected.push({
            applicationId: app._id,
            priority: "High",
            description: "User will pay cash on reception",
            tenantName,
            dueLabel: due.dueLabel,
            _dueTs: due.dueTs,
            _creationTime: app._creationTime,
          });
        }

        // High priority: when the tenant pays or completes E-KYC, room assignment becomes actionable.
        if ((isPaid || isEkycSubmitted) && !isCashOnReception && !app.assignedRoomId) {
          collected.push({
            applicationId: app._id,
            priority: "High",
            description: "Assign a room to new tenant",
            tenantName,
            dueLabel: due.dueLabel,
            _dueTs: due.dueTs,
            _creationTime: app._creationTime,
          });
        }

        // Medium/Low follow-ups so the tab can show multiple priorities.
        if (isEkycSubmitted && !isPaid && !isCashOnReception) {
          collected.push({
            applicationId: app._id,
            priority: "Medium",
            description: "Complete rent payment",
            tenantName,
            dueLabel: due.dueLabel,
            _dueTs: due.dueTs,
            _creationTime: app._creationTime,
          });
        }

        if (isEkycSubmitted && app.agreementAccepted !== true) {
          collected.push({
            applicationId: app._id,
            priority: "Medium",
            description: "Sign rental agreement",
            tenantName,
            dueLabel: due.dueLabel,
            _dueTs: due.dueTs,
            _creationTime: app._creationTime,
          });
        }

        if (isEkycSubmitted && (app.emergencyContacts?.length ?? 0) === 0) {
          collected.push({
            applicationId: app._id,
            priority: "Low",
            description: "Add emergency contacts",
            tenantName,
            dueLabel: due.dueLabel,
            _dueTs: due.dueTs,
            _creationTime: app._creationTime,
          });
        }

        if (collected.length >= limit) break;
      }

      if (collected.length >= limit) break;
    }

    // Pull open complaint tasks for this operator's properties.
    for (const property of properties) {
      const complaints = await ctx.db
        .query("complaints")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .order("desc")
        .take(100);

      for (const c of complaints) {
        if (c.status === "resolved") continue;
        const tenant = await ctx.db.get(c.tenantUserId);
        const tenantName = tenant?.name?.trim() || "Tenant";
        collected.push({
          applicationId: c._id as any,
          priority: c.priority,
          description: `Complaint: ${c.problemTitle}`,
          tenantName,
          dueLabel: "Needs attention",
          _dueTs: null,
          _creationTime: c._creationTime,
        });
        if (collected.length >= limit * 2) break;
      }
    }

    collected.sort((a, b) => {
      const pw = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (pw !== 0) return pw;

      if (a._dueTs != null && b._dueTs != null) return a._dueTs - b._dueTs;
      if (a._dueTs != null) return -1;
      if (b._dueTs != null) return 1;

      // Newer first as a tie-breaker.
      return b._creationTime - a._creationTime;
    });

    return {
      items: collected.slice(0, limit).map((t) => ({
        applicationId: t.applicationId,
        priority: t.priority,
        description: t.description,
        tenantName: t.tenantName,
        dueLabel: t.dueLabel,
      })),
    };
  },
});

export const getRoomAssignmentTask = query({
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

    if (app.assignedRoomId) {
      return {
        notFound: false as const,
        alreadyAssigned: true as const,
        assignedRoomNumber: app.assignedRoomNumber ?? null,
      };
    }

    const tenantUser = await ctx.db.get(app.tenantUserId);
    const roomOption =
      app.selectedRoomOptionId !== undefined
        ? await ctx.db.get(app.selectedRoomOptionId)
        : null;

    const roomOptionLabel = roomOption ? roomOptionSummary(roomOption) : "Any available room";

    const apps = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .take(500);
    const assignedRoomIds = new Set<Id<"rooms">>();
    for (const x of apps) {
      if (x.assignedRoomId) assignedRoomIds.add(x.assignedRoomId);
    }

    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .take(200);

    const availableRooms = rooms
      .filter((r) => !assignedRoomIds.has(r._id))
      .filter((r) =>
        app.selectedRoomOptionId ? r.roomOptionId === app.selectedRoomOptionId : true,
      )
      .map((r) => ({
        roomId: r._id,
        roomLabel: r.roomNumber,
      }));

    return {
      notFound: false as const,
      alreadyAssigned: false as const,
      applicationId: app._id,
      propertyName: property.name?.trim() || "Unnamed property",
      tenantName: app.legalNameAsOnId,
      phone: app.phone,
      imageUrl: tenantUser?.imageUrl,
      paymentStatus: app.paymentStatus,
      paymentMethod: app.paymentMethod ?? null,
      roomOptionLabel,
      availableRooms,
    };
  },
});

export const assignRoomToTenant = mutation({
  args: {
    applicationId: v.id("tenantMoveInApplications"),
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) {
      throw new Error("Unauthenticated");
    }

    const operator = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!operator) {
      throw new Error("Operator not found");
    }

    const app = await ctx.db.get(args.applicationId);
    if (!app) {
      throw new Error("Task not found");
    }

    const property = await ctx.db.get(app.propertyId);
    if (!property || property.userId !== operator._id) {
      throw new Error("You do not have access to this tenant");
    }

    if (app.assignedRoomId) {
      throw new Error("Room already assigned");
    }
    if (app.paymentMethod === "Cash" && app.paymentStatus !== "paid") {
      throw new Error("Mark cash payment as paid before assigning a room");
    }

    const room = await ctx.db.get(args.roomId);
    if (!room || room.propertyId !== property._id) {
      throw new Error("Invalid room selection");
    }

    await ctx.db.patch(args.applicationId, {
      assignedAt: Date.now(),
      assignedRoomId: room._id,
      assignedRoomNumber: room.roomNumber,
      ...(room.roomOptionId !== undefined ? { selectedRoomOptionId: room.roomOptionId } : {}),
    });

    return { assignedRoomNumber: room.roomNumber };
  },
});

export const markCashPaymentReceived = mutation({
  args: { applicationId: v.id("tenantMoveInApplications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) {
      throw new Error("Unauthenticated");
    }

    const operator = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!operator) {
      throw new Error("Operator not found");
    }

    const app = await ctx.db.get(args.applicationId);
    if (!app) {
      throw new Error("Task not found");
    }

    const property = await ctx.db.get(app.propertyId);
    if (!property || property.userId !== operator._id) {
      throw new Error("You do not have access to this tenant");
    }

    if (app.paymentMethod !== "Cash") {
      throw new Error("This task is only for cash-on-reception payments");
    }
    if (app.paymentStatus === "paid") {
      return { updated: false };
    }

    await ctx.db.patch(app._id, { paymentStatus: "paid" });
    return { updated: true };
  },
});

export const markPaymentReceived = mutation({
  args: { applicationId: v.id("tenantMoveInApplications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) throw new Error("Unauthenticated");

    const operator = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!operator) throw new Error("Operator not found");

    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    const property = await ctx.db.get(app.propertyId);
    if (!property || property.userId !== operator._id) {
      throw new Error("You do not have access to this tenant");
    }

    if (app.paymentStatus === "paid") return { updated: false };

    await ctx.db.patch(app._id, { paymentStatus: "paid" });
    return { updated: true };
  },
});

export const getPropertyRoomOptionsForTenant = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return { items: [] };

    const options = await ctx.db
      .query("roomOptions")
      .withIndex("by_property_and_category", (q) =>
        q.eq("propertyId", args.propertyId),
      )
      .take(30);

    return {
      items: options.map((o) => ({
        id: o._id,
        label: roomOptionSummary(o),
        rentAmount: o.rentAmount ?? null,
        category: o.category,
      })),
    };
  },
});

