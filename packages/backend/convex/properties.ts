import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Parse an agreement duration string (e.g. "6 months", "1 year") into a month
 * count. Logs an error and returns 1 when the format is unrecognised so callers
 * always get a usable value and the bad data is visible in server logs.
 */
function parseDurationMonths(duration: string | undefined | null, context: string): number {
  if (!duration) return 1;
  const s = duration.trim().toLowerCase();
  const mm = s.match(/^(\d+)\s*month/);
  if (mm) return parseInt(mm[1]!, 10);
  const ym = s.match(/^(\d+)\s*year/);
  if (ym) return parseInt(ym[1]!, 10) * 12;
  console.error(
    `[${context}] Unparseable onboardingAgreementDuration: "${duration}" — defaulting to 1 month. Fix the stored value to avoid incorrect rent/coverage calculations.`,
  );
  return 1;
}

/** Add n calendar months to a timestamp, preserving day-of-month semantics. */
function addMonths(ts: number, n: number): number {
  const d = new Date(ts);
  const targetMonth = d.getMonth() + n;
  d.setMonth(targetMonth);
  // If setMonth overflowed (e.g. Jan 31 + 1mo → Mar 3), clamp back to last day of intended month
  const intendedMonth = ((targetMonth % 12) + 12) % 12;
  if (d.getMonth() !== intendedMonth) {
    d.setDate(0); // last day of the previous (intended) month
  }
  return d.getTime();
}

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
    app.status === "onboarded" ||
    app.status === "quick_request" ||
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

    let properties: Doc<"properties">[];
    if (user.primaryPropertyId) {
      const primary = await ctx.db.get(user.primaryPropertyId);
      properties = primary && primary.userId === user._id ? [primary] : [];
    } else {
      properties = await ctx.db
        .query("properties")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(500);
    }

    function parseDurationMonthsForStats(duration: string): number | null {
      const s = duration.trim().toLowerCase();
      const monthMatch = s.match(/^(\d+)\s*month/);
      if (monthMatch) return parseInt(monthMatch[1], 10);
      const yearMatch = s.match(/^(\d+)\s*year/);
      if (yearMatch) return parseInt(yearMatch[1], 10) * 12;
      return null;
    }

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
        const rentAmount = roomOption.rentAmount;
        if (
          typeof rentAmount === "number" &&
          !Number.isNaN(rentAmount) &&
          rentAmount > 0
        ) {
          const rentMonths = parseDurationMonths(app.onboardingAgreementDuration, "getDashboardPropertyStats");
          const securityDeposit =
            typeof app.onboardingSecurityDeposit === "number" && app.onboardingSecurityDeposit > 0
              ? app.onboardingSecurityDeposit
              : 0;
          totalPaidRentAmount += rentAmount * rentMonths + securityDeposit;
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

    let properties: Doc<"properties">[];
    if (user.primaryPropertyId) {
      const primary = await ctx.db.get(user.primaryPropertyId);
      properties = primary && primary.userId === user._id ? [primary] : [];
    } else {
      properties = await ctx.db
        .query("properties")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(500);
    }

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
        // Only show tenants who have paid
        if (app.paymentStatus !== "paid") {
          continue;
        }
        // Skip tenants who have already moved out
        if (app.moveOutDate) {
          continue;
        }
        // Skip tenants whose move-in date has already passed
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
      /** Dynamically computed: true if rent coverage has expired */
      isRentDue: boolean;
      rentDueAmount: number;
    };

    const collected: Collected[] = [];
    const now = Date.now();
    const roomOptionCache = new Map<Id<"roomOptions">, Doc<"roomOptions"> | null>();

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

        // Compute dynamic rent-due status for paid tenants
        let isRentDue = false;
        let rentDueAmount = 0;

        if (app.paymentStatus === "paid" && app.selectedRoomOptionId) {
          let roomOption = roomOptionCache.get(app.selectedRoomOptionId);
          if (roomOption === undefined) {
            roomOption = await ctx.db.get(app.selectedRoomOptionId);
            roomOptionCache.set(app.selectedRoomOptionId, roomOption);
          }

          if (roomOption && roomOption.propertyId === p._id) {
            const monthlyRent = roomOption.rentAmount ?? 0;
            const coverageStart = app.assignedAt ?? app._creationTime;
            const initialMonths = parseDurationMonths(app.onboardingAgreementDuration, "listOnboardedTenantsForManage");

            // Add extend-stay months
            const txs = await ctx.db
              .query("rentTransactions")
              .withIndex("by_application", (q) => q.eq("applicationId", app._id))
              .take(200);
            let totalMonths = initialMonths;
            for (const tx of txs) {
              if (tx.status === "paid") totalMonths += tx.months;
            }

            const coverageEnd = addMonths(coverageStart, totalMonths);
            if (coverageEnd < now && monthlyRent > 0) {
              isRentDue = true;
              const overdueMs = now - coverageEnd;
              const overdueMonths = Math.max(1, Math.ceil(overdueMs / (30.44 * 24 * 60 * 60 * 1000)));
              rentDueAmount = monthlyRent * overdueMonths;
            }
          }
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
          isRentDue,
          rentDueAmount,
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
      isRentDue: boolean;
      rentDueAmount: number;
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
        isRentDue: row.isRentDue,
        rentDueAmount: row.rentDueAmount,
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

    let properties: Doc<"properties">[];
    if (user.primaryPropertyId) {
      const primary = await ctx.db.get(user.primaryPropertyId);
      properties = primary && primary.userId === user._id ? [primary] : [];
    } else {
      properties = await ctx.db
        .query("properties")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(500);
    }
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

    function parseDurationMonthsCredited(duration: string): number | null {
      const s = duration.trim().toLowerCase();
      const monthMatch = s.match(/^(\d+)\s*month/);
      if (monthMatch) return parseInt(monthMatch[1], 10);
      const yearMatch = s.match(/^(\d+)\s*year/);
      if (yearMatch) return parseInt(yearMatch[1], 10) * 12;
      return null;
    }

    const creditedRows: Array<{
      applicationId: Id<"tenantMoveInApplications">;
      _creationTime: number;
      tenantName: string;
      amount: number;
      breakdown: string;
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

      const rentAmount = roomOption.rentAmount;
      if (typeof rentAmount !== "number" || Number.isNaN(rentAmount) || rentAmount <= 0) {
        continue;
      }

      const securityDeposit =
        typeof app.onboardingSecurityDeposit === "number" && app.onboardingSecurityDeposit > 0
          ? app.onboardingSecurityDeposit
          : 0;

      const rentMonths = parseDurationMonthsCredited(app.onboardingAgreementDuration ?? "") ?? 1;

      const totalRent = rentAmount * rentMonths;
      const totalAmount = totalRent + securityDeposit;

      const parts: string[] = [];
      if (rentMonths > 1) {
        parts.push(`Rent ×${rentMonths}mo`);
      } else {
        parts.push("Rent");
      }
      if (securityDeposit > 0) {
        parts.push("Security");
      }
      const breakdown = parts.join(" + ");

      creditedRows.push({
        applicationId: app._id,
        _creationTime: app._creationTime,
        tenantName: app.legalNameAsOnId ?? "",
        amount: totalAmount,
        breakdown,
      });
    }

    creditedRows.sort((a, b) => b._creationTime - a._creationTime);

    return {
      items: creditedRows.slice(0, limit).map((row) => ({
        applicationId: row.applicationId,
        tenantName: row.tenantName,
        amount: row.amount,
        breakdown: row.breakdown,
        createdAt: row._creationTime,
        type: "credit" as const,
      })),
    };
  },
});

/**
 * Returns 4-week rent collection totals for the current calendar month.
 * Aggregates both initial move-in payments (tenantMoveInApplications) and
 * extend-stay payments (rentTransactions) for the operator's active property.
 */
export const getMonthlyRentChartData = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return null;

    let properties: Doc<"properties">[];
    if (user.primaryPropertyId) {
      const primary = await ctx.db.get(user.primaryPropertyId);
      properties = primary && primary.userId === user._id ? [primary] : [];
    } else {
      properties = await ctx.db
        .query("properties")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(500);
    }
    if (properties.length === 0) {
      return { weeks: [0, 0, 0, 0] };
    }

    const propertyIdSet = new Set(properties.map((p) => p._id));

    // Compute week start timestamps for the current month (UTC)
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    // Week boundaries: 1–7, 8–14, 15–21, 22–end
    const weekBoundaries = [
      { start: monthStart.getTime(), end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 8)).getTime() },
      { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 8)).getTime(), end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15)).getTime() },
      { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15)).getTime(), end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 22)).getTime() },
      { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 22)).getTime(), end: monthEnd.getTime() },
    ];

    const weekTotals = [0, 0, 0, 0];

    function getWeekIndex(ts: number): number {
      for (let i = 0; i < weekBoundaries.length; i++) {
        const wb = weekBoundaries[i]!;
        if (ts >= wb.start && ts < wb.end) return i;
      }
      return -1;
    }

    function parseDurationMonthsLocal(duration: string): number | null {
      const s = duration.trim().toLowerCase();
      const monthMatch = s.match(/^(\d+)\s*month/);
      if (monthMatch) return parseInt(monthMatch[1], 10);
      const yearMatch = s.match(/^(\d+)\s*year/);
      if (yearMatch) return parseInt(yearMatch[1], 10) * 12;
      return null;
    }

    // Aggregate initial move-in payments from tenantMoveInApplications
    const roomOptionCache = new Map<Id<"roomOptions">, Doc<"roomOptions"> | null>();
    for (const property of properties) {
      const apps = await ctx.db
        .query("tenantMoveInApplications")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .take(500);

      for (const app of apps) {
        if (app.paymentStatus !== "paid" || !app.selectedRoomOptionId) continue;
        const ts = app.paidAt ?? app._creationTime;
        if (ts < monthStart.getTime() || ts >= monthEnd.getTime()) continue;
        const weekIdx = getWeekIndex(ts);
        if (weekIdx === -1) continue;

        let roomOption = roomOptionCache.get(app.selectedRoomOptionId);
        if (roomOption === undefined) {
          roomOption = await ctx.db.get(app.selectedRoomOptionId);
          roomOptionCache.set(app.selectedRoomOptionId, roomOption);
        }
        if (!roomOption) continue;
        if (!propertyIdSet.has(roomOption.propertyId)) continue;

        const rentAmount = roomOption.rentAmount;
        if (typeof rentAmount !== "number" || rentAmount <= 0) continue;

        const securityDeposit =
          typeof app.onboardingSecurityDeposit === "number" && app.onboardingSecurityDeposit > 0
            ? app.onboardingSecurityDeposit
            : 0;
        const rentMonths = parseDurationMonths(app.onboardingAgreementDuration, "getMonthlyRentChartData");

        weekTotals[weekIdx] = (weekTotals[weekIdx] ?? 0) + rentAmount * rentMonths + securityDeposit;
      }
    }

    // Aggregate extend-stay payments from rentTransactions
    for (const property of properties) {
      const txs = await ctx.db
        .query("rentTransactions")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .take(500);

      for (const tx of txs) {
        if (tx.status !== "paid") continue;
        const ts = tx._creationTime;
        if (ts < monthStart.getTime() || ts >= monthEnd.getTime()) continue;
        const weekIdx = getWeekIndex(ts);
        if (weekIdx === -1) continue;
        weekTotals[weekIdx] = (weekTotals[weekIdx] ?? 0) + tx.amount;
      }
    }

    return { weeks: weekTotals };
  },
});

/**
 * Returns total rent collected in the current calendar month and the previous
 * calendar month, used to compute the month-over-month growth badge in the
 * Balance Card.
 */
export const getMonthlyGrowth = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return null;

    let properties: Doc<"properties">[];
    if (user.primaryPropertyId) {
      const primary = await ctx.db.get(user.primaryPropertyId);
      properties = primary && primary.userId === user._id ? [primary] : [];
    } else {
      properties = await ctx.db
        .query("properties")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(500);
    }
    if (properties.length === 0) return { currentMonth: 0, previousMonth: 0 };

    const now = new Date();
    const curStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const curEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    const prevStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
    const prevEnd = curStart;

    function parseDurationMonthsMG(duration: string): number | null {
      const s = duration.trim().toLowerCase();
      const mm = s.match(/^(\d+)\s*month/);
      if (mm) return parseInt(mm[1]!, 10);
      const ym = s.match(/^(\d+)\s*year/);
      if (ym) return parseInt(ym[1]!, 10) * 12;
      return null;
    }

    let currentMonth = 0;
    let previousMonth = 0;
    const roomOptionCache = new Map<Id<"roomOptions">, Doc<"roomOptions"> | null>();

    for (const property of properties) {
      // Initial move-in payments
      const apps = await ctx.db
        .query("tenantMoveInApplications")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .take(500);

      for (const app of apps) {
        if (app.paymentStatus !== "paid" || !app.selectedRoomOptionId) continue;
        const ts = app.paidAt ?? app._creationTime;
        const inCur = ts >= curStart && ts < curEnd;
        const inPrev = ts >= prevStart && ts < prevEnd;
        if (!inCur && !inPrev) continue;

        let roomOption = roomOptionCache.get(app.selectedRoomOptionId);
        if (roomOption === undefined) {
          roomOption = await ctx.db.get(app.selectedRoomOptionId);
          roomOptionCache.set(app.selectedRoomOptionId, roomOption);
        }
        if (!roomOption || roomOption.propertyId !== property._id) continue;
        const rent = roomOption.rentAmount;
        if (typeof rent !== "number" || rent <= 0) continue;

        const months = parseDurationMonths(app.onboardingAgreementDuration, "getMonthlyGrowth");
        const security =
          typeof app.onboardingSecurityDeposit === "number" && app.onboardingSecurityDeposit > 0
            ? app.onboardingSecurityDeposit
            : 0;
        const total = rent * months + security;

        if (inCur) currentMonth += total;
        else previousMonth += total;
      }

      // Extend-stay / renewal payments
      const txs = await ctx.db
        .query("rentTransactions")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .take(500);

      for (const tx of txs) {
        if (tx.status !== "paid") continue;
        const ts = tx._creationTime;
        if (ts >= curStart && ts < curEnd) currentMonth += tx.amount;
        else if (ts >= prevStart && ts < prevEnd) previousMonth += tx.amount;
      }
    }

    return { currentMonth, previousMonth };
  },
});

/**
 * Returns all payments (initial move-ins + extend-stay rent transactions) for
 * the operator's active property, sorted newest first. Used by the Payments tab.
 */
export const getAllPaymentsForOperator = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return null;

    let properties: Doc<"properties">[];
    if (user.primaryPropertyId) {
      const primary = await ctx.db.get(user.primaryPropertyId);
      properties = primary && primary.userId === user._id ? [primary] : [];
    } else {
      properties = await ctx.db
        .query("properties")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(500);
    }
    if (properties.length === 0) return { items: [] };

    const propertyMap = new Map(properties.map((p) => [p._id, p]));

    function parseDurationMonthsP(duration: string): number | null {
      const s = duration.trim().toLowerCase();
      const mm = s.match(/^(\d+)\s*month/);
      if (mm) return parseInt(mm[1]!, 10);
      const ym = s.match(/^(\d+)\s*year/);
      if (ym) return parseInt(ym[1]!, 10) * 12;
      return null;
    }

    const roomOptionCache = new Map<Id<"roomOptions">, Doc<"roomOptions"> | null>();
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();

    type PaymentItem = {
      id: string;
      applicationId: string;
      type: "move_in" | "extend";
      tenantName: string;
      tenantImageUrl?: string;
      roomNumber?: string;
      propertyName?: string;
      amount: number;
      rentAmount: number;
      months: number;
      securityDeposit: number;
      paymentMethod?: string;
      paidAt: number;
      status: "paid" | "pending";
      description: string;
      periodStart: number;
      periodEnd: number;
    };

    const items: PaymentItem[] = [];

    for (const property of properties) {
      const apps = await ctx.db
        .query("tenantMoveInApplications")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .take(500);

      for (const app of apps) {
        if (!app.selectedRoomOptionId) continue;

        let roomOption = roomOptionCache.get(app.selectedRoomOptionId);
        if (roomOption === undefined) {
          roomOption = await ctx.db.get(app.selectedRoomOptionId);
          roomOptionCache.set(app.selectedRoomOptionId, roomOption);
        }
        if (!roomOption || roomOption.propertyId !== property._id) continue;
        const rentAmount = roomOption.rentAmount ?? 0;

        const initialMonths = parseDurationMonths(app.onboardingAgreementDuration, "getAllPaymentsForOperator");
        const securityDeposit =
          typeof app.onboardingSecurityDeposit === "number" && app.onboardingSecurityDeposit > 0
            ? app.onboardingSecurityDeposit
            : 0;
        const totalAmount = rentAmount * initialMonths + securityDeposit;

        // Resolve tenant avatar
        let tenantUser = userCache.get(app.tenantUserId);
        if (tenantUser === undefined) {
          tenantUser = await ctx.db.get(app.tenantUserId);
          userCache.set(app.tenantUserId, tenantUser);
        }

        const periodStart = app.assignedAt ?? app._creationTime;
        const periodEnd = addMonths(periodStart, initialMonths);

        items.push({
          id: `movein_${app._id}`,
          applicationId: app._id,
          type: "move_in",
          tenantName: app.legalNameAsOnId ?? "Unknown",
          tenantImageUrl: tenantUser?.imageUrl,
          roomNumber: app.assignedRoomNumber,
          propertyName: property.name ?? undefined,
          amount: totalAmount,
          rentAmount,
          months: initialMonths,
          securityDeposit,
          paymentMethod: app.paymentMethod,
          paidAt: app.paidAt ?? app._creationTime,
          status: app.paymentStatus === "paid" ? "paid" : "pending",
          description: initialMonths > 1 ? `Rent ×${initialMonths}mo + Security deposit` : "Rent + Security deposit",
          periodStart,
          periodEnd,
        });

        // Fetch extend-stay transactions for this application
        const txs = await ctx.db
          .query("rentTransactions")
          .withIndex("by_application", (q) => q.eq("applicationId", app._id))
          .take(200);

        // Sort to compute cumulative coverage periods
        txs.sort((a, b) => a._creationTime - b._creationTime);
        let coverageEnd = periodEnd;

        for (const tx of txs) {
          if (tx.status !== "paid") continue;
          const txPeriodStart = coverageEnd;
          const txPeriodEnd = addMonths(txPeriodStart, tx.months);
          coverageEnd = txPeriodEnd;

          items.push({
            id: `tx_${tx._id}`,
            applicationId: app._id,
            type: "extend",
            tenantName: app.legalNameAsOnId ?? "Unknown",
            tenantImageUrl: tenantUser?.imageUrl,
            roomNumber: app.assignedRoomNumber,
            propertyName: property.name ?? undefined,
            amount: tx.amount,
            rentAmount,
            months: tx.months,
            securityDeposit: 0,
            paymentMethod: app.paymentMethod,
            paidAt: tx._creationTime,
            status: tx.status,
            description: tx.description,
            periodStart: txPeriodStart,
            periodEnd: txPeriodEnd,
          });
        }

        // Generate a virtual "pending" item if tenant's coverage has expired
        if (app.paymentStatus === "paid" && isMoveInKycComplete(app)) {
          const now = Date.now();
          if (coverageEnd < now) {
            // How many full months overdue
            const overdueMs = now - coverageEnd;
            const overdueMonths = Math.max(
              1,
              Math.ceil(overdueMs / (30.44 * 24 * 60 * 60 * 1000)),
            );
            items.push({
              id: `due_${app._id}`,
              applicationId: app._id,
              type: "extend",
              tenantName: app.legalNameAsOnId ?? "Unknown",
              tenantImageUrl: tenantUser?.imageUrl,
              roomNumber: app.assignedRoomNumber,
              propertyName: property.name ?? undefined,
              amount: rentAmount * overdueMonths,
              rentAmount,
              months: overdueMonths,
              securityDeposit: 0,
              paymentMethod: undefined,
              paidAt: coverageEnd, // sort key: when it became due
              status: "pending",
              description:
                overdueMonths === 1
                  ? "Rent due (1 month)"
                  : `Rent due (${overdueMonths} months)`,
              periodStart: coverageEnd,
              periodEnd: addMonths(coverageEnd, overdueMonths),
            });
          }
        }
      }
    }

    items.sort((a, b) => b.paidAt - a.paidAt);
    return { items };
  },
});

/**
 * Returns detailed payment info for a specific payment (move-in or extend-stay)
 * identified by the encoded id string: "movein_{appId}" or "tx_{txId}".
 * Also returns the tenant's all-time payment summary.
 */
export const getPaymentDetailForOperator = query({
  args: { encodedId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return null;

    function parseDurationMonthsPD(duration: string): number | null {
      const s = duration.trim().toLowerCase();
      const mm = s.match(/^(\d+)\s*month/);
      if (mm) return parseInt(mm[1]!, 10);
      const ym = s.match(/^(\d+)\s*year/);
      if (ym) return parseInt(ym[1]!, 10) * 12;
      return null;
    }

    let app: Doc<"tenantMoveInApplications"> | null = null;
    let txDoc: Doc<"rentTransactions"> | null = null;
    let isMoveIn = false;

    if (args.encodedId.startsWith("movein_")) {
      const appId = args.encodedId.slice("movein_".length) as Id<"tenantMoveInApplications">;
      app = await ctx.db.get(appId);
      isMoveIn = true;
    } else if (args.encodedId.startsWith("tx_")) {
      const txId = args.encodedId.slice("tx_".length) as Id<"rentTransactions">;
      txDoc = await ctx.db.get(txId);
      if (txDoc) app = await ctx.db.get(txDoc.applicationId);
    }

    if (!app) return null;

    // Verify operator owns this property
    const property = await ctx.db.get(app.propertyId);
    if (!property || property.userId !== user._id) return null;

    // Resolve room option
    const roomOption = app.selectedRoomOptionId
      ? await ctx.db.get(app.selectedRoomOptionId)
      : null;
    const rentAmount = roomOption?.rentAmount ?? 0;

    const initialMonths = parseDurationMonths(app.onboardingAgreementDuration, "getPaymentDetailForOperator");
    const securityDeposit =
      typeof app.onboardingSecurityDeposit === "number" && app.onboardingSecurityDeposit > 0
        ? app.onboardingSecurityDeposit
        : 0;

    // Resolve tenant user for image
    const tenantUser = await ctx.db.get(app.tenantUserId);

    // Fetch propertyRent for grace period and other rent config
    const propertyRent = await ctx.db
      .query("propertyRent")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .unique();

    // Compute initial coverage period
    const initPeriodStart = app.assignedAt ?? app._creationTime;
    const initPeriodEnd = addMonths(initPeriodStart, initialMonths);

    // All transactions for this application
    const allTxs = await ctx.db
      .query("rentTransactions")
      .withIndex("by_application", (q) => q.eq("applicationId", app!._id))
      .take(200);
    allTxs.sort((a, b) => a._creationTime - b._creationTime);

    // Build period map for extend-stay txs
    let coverageEnd = initPeriodEnd;
    const txPeriods = new Map<string, { periodStart: number; periodEnd: number }>();
    for (const tx of allTxs) {
      if (tx.status !== "paid") continue;
      const ps = coverageEnd;
      const pe = addMonths(ps, tx.months);
      coverageEnd = pe;
      txPeriods.set(tx._id, { periodStart: ps, periodEnd: pe });
    }

    // This payment's data
    let amount: number;
    let months: number;
    let periodStart: number;
    let periodEnd: number;
    let description: string;
    let paidAt: number;
    let paymentMode: string | undefined;

    if (isMoveIn) {
      amount = rentAmount * initialMonths + securityDeposit;
      months = initialMonths;
      periodStart = initPeriodStart;
      periodEnd = initPeriodEnd;
      description = initialMonths > 1 ? `Rent ×${initialMonths}mo + Security deposit` : "Rent + Security deposit";
      paidAt = app._creationTime;
      paymentMode = app.paymentMethod;
    } else if (txDoc) {
      amount = txDoc.amount;
      months = txDoc.months;
      const period = txPeriods.get(txDoc._id);
      periodStart = period?.periodStart ?? app._creationTime;
      periodEnd = period?.periodEnd ?? addMonths(periodStart, months);
      description = txDoc.description;
      paidAt = txDoc._creationTime;
      paymentMode = app.paymentMethod;
    } else {
      return null;
    }

    // Tenant all-time payment summary
    const totalPaidFromTxs = allTxs
      .filter((t) => t.status === "paid")
      .reduce((sum, t) => sum + t.amount, 0);
    const moveInAmount = rentAmount * initialMonths + securityDeposit;
    const allTimePaid =
      app.paymentStatus === "paid" ? moveInAmount + totalPaidFromTxs : totalPaidFromTxs;

    // Pending = coverage elapsed with no renewal
    const pendingMonthlyRent = coverageEnd < Date.now() ? rentAmount : 0;

    return {
      encodedId: args.encodedId,
      applicationId: app._id,
      tenantName: app.legalNameAsOnId ?? "Unknown",
      tenantImageUrl: tenantUser?.imageUrl,
      tenantPhone: app.phone,
      roomNumber: app.assignedRoomNumber,
      roomCategory: roomOption?.category,
      propertyName: property.name,
      amount,
      rentAmount,
      months,
      securityDeposit: isMoveIn ? securityDeposit : 0,
      periodStart,
      periodEnd,
      paidAt,
      paymentMode,
      description,
      status: "paid" as const,
      agreementDuration: app.onboardingAgreementDuration,
      rentCycle: app.onboardingRentCycle ?? "Monthly",
      gracePeriodDays: propertyRent?.gracePeriodDays,
      summary: {
        totalPaid: allTimePaid,
        pendingAmount: pendingMonthlyRent,
      },
    };
  },
});

/**
 * Returns tenants whose coverage window has elapsed and no renewal payment has
 * been made — used to populate the "Remind" modal on the dashboard.
 */
export const getOverdueTenantsForReminder = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return null;

    let properties: Doc<"properties">[];
    if (user.primaryPropertyId) {
      const primary = await ctx.db.get(user.primaryPropertyId);
      properties = primary && primary.userId === user._id ? [primary] : [];
    } else {
      properties = await ctx.db
        .query("properties")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(500);
    }
    if (properties.length === 0) return { tenants: [] };

    const now = Date.now();

    function parseDur(duration: string): number | null {
      const s = duration.trim().toLowerCase();
      const mm = s.match(/^(\d+)\s*month/);
      if (mm) return parseInt(mm[1]!, 10);
      const ym = s.match(/^(\d+)\s*year/);
      if (ym) return parseInt(ym[1]!, 10) * 12;
      return null;
    }

    const roomOptionCache = new Map<Id<"roomOptions">, Doc<"roomOptions"> | null>();
    const tenantUserCache = new Map<Id<"users">, Doc<"users"> | null>();

    type OverdueTenant = {
      applicationId: string;
      tenantName: string;
      tenantImageUrl?: string;
      phone?: string;
      roomNumber?: string;
      propertyName?: string;
      monthlyRent: number;
      daysOverdue: number;
    };

    const overdue: OverdueTenant[] = [];

    for (const property of properties) {
      const apps = await ctx.db
        .query("tenantMoveInApplications")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .take(500);

      for (const app of apps) {
        if (app.paymentStatus !== "paid" || !app.selectedRoomOptionId) continue;
        if (!isMoveInKycComplete(app)) continue;

        let roomOption = roomOptionCache.get(app.selectedRoomOptionId);
        if (roomOption === undefined) {
          roomOption = await ctx.db.get(app.selectedRoomOptionId);
          roomOptionCache.set(app.selectedRoomOptionId, roomOption);
        }
        if (!roomOption || roomOption.propertyId !== property._id) continue;
        const monthlyRent = roomOption.rentAmount;
        if (typeof monthlyRent !== "number" || monthlyRent <= 0) continue;

        const initialMonths = parseDurationMonths(app.onboardingAgreementDuration, "getOverdueTenantsForReminder");

        const coverageStart = app.assignedAt ?? app._creationTime;
        let totalMonths = initialMonths;

        const txs = await ctx.db
          .query("rentTransactions")
          .withIndex("by_application", (q) => q.eq("applicationId", app._id))
          .take(200);
        for (const tx of txs) {
          if (tx.status === "paid") totalMonths += tx.months;
        }

        const coverageEnd = addMonths(coverageStart, totalMonths);
        if (coverageEnd >= now) continue; // still covered

        const daysOverdue = Math.floor((now - coverageEnd) / (24 * 60 * 60 * 1000));

        let tenantUser = tenantUserCache.get(app.tenantUserId);
        if (tenantUser === undefined) {
          tenantUser = await ctx.db.get(app.tenantUserId);
          tenantUserCache.set(app.tenantUserId, tenantUser);
        }

        overdue.push({
          applicationId: app._id,
          tenantName: app.legalNameAsOnId ?? "Unknown",
          tenantImageUrl: tenantUser?.imageUrl,
          phone: app.phone,
          roomNumber: app.assignedRoomNumber,
          propertyName: property.name ?? undefined,
          monthlyRent,
          daysOverdue,
        });
      }
    }

    overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
    return { tenants: overdue };
  },
});

/**
 * Returns total rent collected in the current calendar year — used in the
 * "More → Yearly" dropdown on the dashboard Balance Card.
 */
export const getYearlyCollectionTotal = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return null;

    let properties: Doc<"properties">[];
    if (user.primaryPropertyId) {
      const primary = await ctx.db.get(user.primaryPropertyId);
      properties = primary && primary.userId === user._id ? [primary] : [];
    } else {
      properties = await ctx.db
        .query("properties")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(500);
    }
    if (properties.length === 0) return { total: 0 };

    const now = new Date();
    const yearStart = Date.UTC(now.getUTCFullYear(), 0, 1);
    const yearEnd = Date.UTC(now.getUTCFullYear() + 1, 0, 1);

    function parseDurY(duration: string): number | null {
      const s = duration.trim().toLowerCase();
      const mm = s.match(/^(\d+)\s*month/);
      if (mm) return parseInt(mm[1]!, 10);
      const ym = s.match(/^(\d+)\s*year/);
      if (ym) return parseInt(ym[1]!, 10) * 12;
      return null;
    }

    let total = 0;
    const roomOptionCache = new Map<Id<"roomOptions">, Doc<"roomOptions"> | null>();

    for (const property of properties) {
      const apps = await ctx.db
        .query("tenantMoveInApplications")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .take(500);

      for (const app of apps) {
        if (app.paymentStatus !== "paid" || !app.selectedRoomOptionId) continue;
        const ts = app.paidAt ?? app._creationTime;
        if (ts >= yearStart && ts < yearEnd) {
          let roomOption = roomOptionCache.get(app.selectedRoomOptionId);
          if (roomOption === undefined) {
            roomOption = await ctx.db.get(app.selectedRoomOptionId);
            roomOptionCache.set(app.selectedRoomOptionId, roomOption);
          }
          if (!roomOption || roomOption.propertyId !== property._id) continue;
          const rent = roomOption.rentAmount ?? 0;
          const months = parseDurationMonths(app.onboardingAgreementDuration, "getYearlyCollectionTotal");
          const security =
            typeof app.onboardingSecurityDeposit === "number"
              ? app.onboardingSecurityDeposit
              : 0;
          total += rent * months + security;
        }
      }

      const txs = await ctx.db
        .query("rentTransactions")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .take(500);
      for (const tx of txs) {
        if (tx.status === "paid" && tx._creationTime >= yearStart && tx._creationTime < yearEnd) {
          total += tx.amount;
        }
      }
    }

    return { total };
  },
});

/**
 * Returns pending (overdue after agreement expiry) and received-last-24h totals
 * for the operator's active property, shown in the Balance Card stat row.
 *
 * Pending: tenants whose coverage window (initial agreement + any renewal/extend
 * payments) has already elapsed but have not yet paid again.
 *
 * Received last 24h: sum of all paid move-in initial payments and extend-stay
 * rent transactions whose _creationTime falls within the last 24 hours.
 */
export const getDashboardCollectionSummary = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return null;

    let properties: Doc<"properties">[];
    if (user.primaryPropertyId) {
      const primary = await ctx.db.get(user.primaryPropertyId);
      properties = primary && primary.userId === user._id ? [primary] : [];
    } else {
      properties = await ctx.db
        .query("properties")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(500);
    }
    if (properties.length === 0) {
      return { pendingAmount: 0, receivedLast24h: 0 };
    }

    const now = Date.now();
    const windowStart = now - 24 * 60 * 60 * 1000;

    function parseDurationMonthsCS(duration: string): number | null {
      const s = duration.trim().toLowerCase();
      const monthMatch = s.match(/^(\d+)\s*month/);
      if (monthMatch) return parseInt(monthMatch[1], 10);
      const yearMatch = s.match(/^(\d+)\s*year/);
      if (yearMatch) return parseInt(yearMatch[1], 10) * 12;
      return null;
    }

    let pendingAmount = 0;
    let receivedLast24h = 0;
    const tenantsWithDues: Array<{
      applicationId: Id<"tenantMoveInApplications">;
      tenantName: string;
      imageUrl?: string;
      roomNumber?: string;
      dueAmount: number;
      overdueMonths: number;
    }> = [];
    const roomOptionCache = new Map<Id<"roomOptions">, Doc<"roomOptions"> | null>();

    for (const property of properties) {
      const apps = await ctx.db
        .query("tenantMoveInApplications")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .take(500);

      for (const app of apps) {
        // Only consider active, fully-paid tenants with a room option
        if (app.paymentStatus !== "paid" || !app.selectedRoomOptionId) continue;
        if (!isMoveInKycComplete(app)) continue;

        let roomOption = roomOptionCache.get(app.selectedRoomOptionId);
        if (roomOption === undefined) {
          roomOption = await ctx.db.get(app.selectedRoomOptionId);
          roomOptionCache.set(app.selectedRoomOptionId, roomOption);
        }
        if (!roomOption || roomOption.propertyId !== property._id) continue;
        const monthlyRent = roomOption.rentAmount;
        if (typeof monthlyRent !== "number" || monthlyRent <= 0) continue;

        const securityDeposit =
          typeof app.onboardingSecurityDeposit === "number" && app.onboardingSecurityDeposit > 0
            ? app.onboardingSecurityDeposit
            : 0;
        const initialMonths = parseDurationMonths(app.onboardingAgreementDuration, "getDashboardCollectionSummary");

        // --- Received last 24h: initial move-in payment ---
        if ((app.paidAt ?? app._creationTime) >= windowStart) {
          receivedLast24h += monthlyRent * initialMonths + securityDeposit;
        }

        // --- Coverage window to determine pending ---
        // Coverage starts at move-in (assignedAt) or application creation time
        const coverageStart = app.assignedAt ?? app._creationTime;
        let totalMonthsCovered = initialMonths;

        // Fetch all rent transactions for this application to extend coverage
        const txs = await ctx.db
          .query("rentTransactions")
          .withIndex("by_application", (q) => q.eq("applicationId", app._id))
          .take(200);

        for (const tx of txs) {
          if (tx.status !== "paid") continue;
          totalMonthsCovered += tx.months;

          // --- Received last 24h: extend-stay payments ---
          if (tx._creationTime >= windowStart) {
            receivedLast24h += tx.amount;
          }
        }

        // If coverage window has elapsed, this tenant's rent is overdue
        const coverageEndTs = addMonths(coverageStart, totalMonthsCovered);
        if (coverageEndTs < now) {
          pendingAmount += monthlyRent;
          const overdueMs = now - coverageEndTs;
          const overdueMonths = Math.max(1, Math.ceil(overdueMs / (30.44 * 24 * 60 * 60 * 1000)));
          const tenant = await ctx.db.get(app.tenantUserId);
          tenantsWithDues.push({
            applicationId: app._id,
            tenantName: app.legalNameAsOnId ?? tenant?.name ?? "Unknown",
            imageUrl: tenant?.imageUrl,
            roomNumber: app.assignedRoomNumber,
            dueAmount: monthlyRent * overdueMonths,
            overdueMonths,
          });
        }
      }
    }

    return { pendingAmount, receivedLast24h, tenantsWithDues };
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

    let properties: Doc<"properties">[];
    if (user.primaryPropertyId) {
      const primary = await ctx.db.get(user.primaryPropertyId);
      properties = primary && primary.userId === user._id ? [primary] : [];
    } else {
      properties = await ctx.db
        .query("properties")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(500);
    }

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

    // Pull open move-out request tasks for this operator's properties.
    for (const property of properties) {
      const moveOutRequests = await ctx.db
        .query("moveOutRequests")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .order("desc")
        .take(100);

      for (const mr of moveOutRequests) {
        if (mr.status === "approved" || mr.status === "rejected") continue;
        const tenant = await ctx.db.get(mr.tenantUserId);
        const tenantName = tenant?.name?.trim() || "Tenant";
        collected.push({
          applicationId: mr._id as any,
          priority: "High" as RoomTaskPriority,
          description: `Move-out Request: ${mr.requestedMoveOutDate}`,
          tenantName,
          dueLabel: `Move-out: ${mr.requestedMoveOutDate}`,
          _dueTs: null,
          _creationTime: mr._creationTime,
        });
        if (collected.length >= limit * 2) break;
      }
    }

    // Pull open shift request tasks for this operator's properties.
    for (const property of properties) {
      const shiftRequests = await ctx.db
        .query("shiftRequests")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .order("desc")
        .take(100);

      for (const sr of shiftRequests) {
        if (sr.status === "approved" || sr.status === "rejected") continue;
        const tenant = await ctx.db.get(sr.tenantUserId);
        const tenantName = tenant?.name?.trim() || "Tenant";
        collected.push({
          applicationId: sr._id as any,
          priority: "Medium" as RoomTaskPriority,
          description: `Shift Request: ${sr.reason}`,
          tenantName,
          dueLabel: "Needs attention",
          _dueTs: null,
          _creationTime: sr._creationTime,
        });
        if (collected.length >= limit * 2) break;
      }
    }

    // Pull rent-due reminder tasks for tenants whose coverage has expired.
    const now = Date.now();
    const roomOptionCacheTask = new Map<Id<"roomOptions">, Doc<"roomOptions"> | null>();

    for (const property of properties) {
      const apps = await ctx.db
        .query("tenantMoveInApplications")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .take(300);

      for (const app of apps) {
        // Only check fully-onboarded paid tenants with assigned rooms
        if (!app.assignedRoomId || app.paymentStatus !== "paid") continue;
        if (!isMoveInKycComplete(app)) continue;
        if (!app.selectedRoomOptionId) continue;

        let roomOption = roomOptionCacheTask.get(app.selectedRoomOptionId);
        if (roomOption === undefined) {
          roomOption = await ctx.db.get(app.selectedRoomOptionId);
          roomOptionCacheTask.set(app.selectedRoomOptionId, roomOption);
        }
        if (!roomOption || roomOption.propertyId !== property._id) continue;
        const monthlyRent = roomOption.rentAmount;
        if (typeof monthlyRent !== "number" || monthlyRent <= 0) continue;

        const coverageStart = app.assignedAt ?? app._creationTime;
        const initialMonths = parseDurationMonths(app.onboardingAgreementDuration, "getRoomAssignmentTasksForOperator");

        const txs = await ctx.db
          .query("rentTransactions")
          .withIndex("by_application", (q) => q.eq("applicationId", app._id))
          .take(200);
        let totalMonths = initialMonths;
        for (const tx of txs) {
          if (tx.status === "paid") totalMonths += tx.months;
        }

        const coverageEnd = addMonths(coverageStart, totalMonths);
        if (coverageEnd >= now) continue; // Still covered

        const overdueMs = now - coverageEnd;
        const overdueDays = Math.ceil(overdueMs / (24 * 60 * 60 * 1000));
        const overdueMonths = Math.max(1, Math.ceil(overdueMs / (30.44 * 24 * 60 * 60 * 1000)));
        const dueAmount = monthlyRent * overdueMonths;
        const formattedAmount = dueAmount >= 1000
          ? `₹${(dueAmount / 1000).toFixed(1)}k`
          : `₹${dueAmount}`;

        const tenantName = app.legalNameAsOnId?.trim() || "Tenant";
        collected.push({
          applicationId: app._id,
          priority: overdueDays > 30 ? "High" as RoomTaskPriority : "Medium" as RoomTaskPriority,
          description: `Send rent reminder — ${formattedAmount} due (${overdueMonths} month${overdueMonths > 1 ? "s" : ""})`,
          tenantName,
          dueLabel: overdueDays > 30
            ? `Overdue ${overdueDays} days`
            : `Due ${overdueDays} day${overdueDays !== 1 ? "s" : ""} ago`,
          _dueTs: coverageEnd,
          _creationTime: app._creationTime,
        });

        if (collected.length >= limit * 3) break;
      }
      if (collected.length >= limit * 3) break;
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
        paymentStatus: app.paymentStatus ?? null,
        paymentMethod: app.paymentMethod ?? null,
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

    await ctx.db.patch(app._id, { paymentStatus: "paid", paidAt: Date.now() });
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

    await ctx.db.patch(app._id, { paymentStatus: "paid", paidAt: Date.now() });
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

/** Returns all properties owned by the current operator. */
export const getOperatorProperties = query({
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
    if (!user) return null;
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return {
      primaryPropertyId: user.primaryPropertyId ?? null,
      properties: properties.map((p) => ({
        id: p._id,
        name: p.name ?? null,
        city: p.city ?? null,
      })),
    };
  },
});

/** Sets the operator's active/primary property. */
export const setPrimaryProperty = mutation({
  args: { propertyId: v.id("properties") },
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
    const property = await ctx.db.get(args.propertyId);
    if (!property || property.userId !== user._id) {
      throw new Error("Property not found or not owned by user");
    }
    await ctx.db.patch(user._id, { primaryPropertyId: args.propertyId });
  },
});

