import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

async function requireTenantUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.tokenIdentifier) throw new Error("Unauthenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) throw new Error("User not found. Sync your account and try again.");
  return user;
}

/**
 * Parses a duration string like "6 months", "12 months", "1 year", "2 years"
 * and returns the equivalent number of months.
 */
function parseDurationMonths(duration: string): number | null {
  const s = duration.trim().toLowerCase();
  const monthMatch = s.match(/^(\d+)\s*month/);
  if (monthMatch) return parseInt(monthMatch[1], 10);
  const yearMatch = s.match(/^(\d+)\s*year/);
  if (yearMatch) return parseInt(yearMatch[1], 10) * 12;
  return null;
}

/** Extracts calendar { year, month (0-based), day } from a ms timestamp using local time. */
function tsToYMD(ts: number): { year: number; month: number; day: number } {
  const d = new Date(ts);
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

/**
 * Adds N months to a YMD date, clamping the day to the last valid day of the
 * target month (e.g. Jan 31 + 1 month → Feb 28/29, not Mar 3).
 */
function addMonthsSafe(
  ymd: { year: number; month: number; day: number },
  months: number,
): { year: number; month: number; day: number } {
  const raw = ymd.month + months;
  const year = ymd.year + Math.floor(raw / 12);
  const month = ((raw % 12) + 12) % 12;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { year, month, day: Math.min(ymd.day, daysInMonth) };
}

/** Compares two YMD dates. Returns negative / 0 / positive like Array.sort. */
function cmpYMD(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number },
): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/** Parses a DD/MM/YYYY string to a YMD object, or null if malformed. */
function parseDDMMYYYY(s: string): { year: number; month: number; day: number } | null {
  const parts = s.trim().split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map((p) => parseInt(p, 10));
  if (isNaN(dd) || isNaN(mm) || isNaN(yyyy)) return null;
  return { year: yyyy, month: mm - 1, day: dd };
}

/** Converts a YMD object to a midnight-local timestamp (ms) for client consumption. */
function ymdToTs(ymd: { year: number; month: number; day: number }): number {
  return new Date(ymd.year, ymd.month, ymd.day).getTime();
}

/** Formats a YMD object for display in error messages. */
function ymdToDisplayString(ymd: { year: number; month: number; day: number }): string {
  return new Date(ymd.year, ymd.month, ymd.day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Returns the tenant's active application info needed for move-out validation. */
export const getTenantAgreementInfo = query({
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

    const apps = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_tenant", (q) => q.eq("tenantUserId", user._id))
      .order("desc")
      .take(10);

    const active = apps.find(
      (a) => a.status === "submitted" || a.assignedRoomId != null,
    );
    if (!active) return null;

    // Prefer per-application agreement duration set during onboarding,
    // fall back to the property's default agreement duration.
    let agreementDuration = active.onboardingAgreementDuration ?? null;
    if (!agreementDuration) {
      const propertyAgreement = await ctx.db
        .query("propertyAgreement")
        .withIndex("by_property", (q) => q.eq("propertyId", active.propertyId))
        .unique();
      agreementDuration = propertyAgreement?.agreementDuration ?? null;
    }

    const months = agreementDuration ? parseDurationMonths(agreementDuration) : null;
    const assignedAt = active.assignedAt ?? null;

    // Compute agreement end as a date-only midnight timestamp to avoid
    // time-of-day mismatches and month-overflow rollovers.
    let agreementEndsAt: number | null = null;
    if (assignedAt != null && months != null) {
      const endYmd = addMonthsSafe(tsToYMD(assignedAt), months);
      agreementEndsAt = ymdToTs(endYmd);
    }

    return {
      applicationId: active._id,
      propertyId: active.propertyId,
      assignedAt,
      agreementDuration,
      agreementEndsAt,
    };
  },
});

export const submitMoveOutRequest = mutation({
  args: {
    propertyId: v.id("properties"),
    applicationId: v.optional(v.id("tenantMoveInApplications")),
    requestedMoveOutDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireTenantUser(ctx);

    const requestedMoveOutDate = args.requestedMoveOutDate.trim();
    if (!requestedMoveOutDate) throw new Error("Move-out date is required.");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found.");

    // Validate the caller-supplied applicationId — fetch it from the DB and
    // verify ownership and property match before trusting it.
    let validatedApplicationId: typeof args.applicationId = undefined;
    if (args.applicationId) {
      const app = await ctx.db.get(args.applicationId);
      if (!app) throw new Error("Application not found.");
      if (app.tenantUserId !== user._id)
        throw new Error("Not authorised: application does not belong to you.");
      if (app.propertyId !== args.propertyId)
        throw new Error("Not authorised: application does not match the given property.");

      // Use the DB-verified _id from here on (not the raw incoming value).
      validatedApplicationId = app._id;

      // Server-side validation: ensure move-out date is not before agreement expiry.
      let agreementDuration = app.onboardingAgreementDuration ?? null;
      if (!agreementDuration) {
        const propertyAgreement = await ctx.db
          .query("propertyAgreement")
          .withIndex("by_property", (q) => q.eq("propertyId", app.propertyId))
          .unique();
        agreementDuration = propertyAgreement?.agreementDuration ?? null;
      }
      const months = agreementDuration ? parseDurationMonths(agreementDuration) : null;
      const assignedAt = app.assignedAt ?? null;

      if (assignedAt != null && months != null) {
        const endYmd = addMonthsSafe(tsToYMD(assignedAt), months);
        const moveOutYmd = parseDDMMYYYY(requestedMoveOutDate);
        if (moveOutYmd !== null && cmpYMD(moveOutYmd, endYmd) < 0) {
          throw new Error(
            `Move-out date must be on or after your agreement end date (${ymdToDisplayString(endYmd)}).`,
          );
        }
      }
    }

    const moveOutRequestId = await ctx.db.insert("moveOutRequests", {
      tenantUserId: user._id,
      propertyId: args.propertyId,
      applicationId: validatedApplicationId,
      requestedMoveOutDate,
      status: "open",
    });

    return { moveOutRequestId };
  },
});

export const getMoveOutRequestById = query({
  args: { moveOutRequestId: v.id("moveOutRequests") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return null;

    const caller = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!caller) return null;

    const req = await ctx.db.get(args.moveOutRequestId);
    if (!req) return null;

    const property = await ctx.db.get(req.propertyId);

    const isTenant = caller._id === req.tenantUserId;
    const isOperator = !!property && property.userId === caller._id;
    if (!isTenant && !isOperator) return null;

    const tenant = await ctx.db.get(req.tenantUserId);

    let assignedRoomNumber: string | null = null;
    if (req.applicationId) {
      const app = await ctx.db.get(req.applicationId);
      assignedRoomNumber = app?.assignedRoomNumber ?? null;
    }

    return {
      moveOutRequestId: req._id,
      applicationId: req.applicationId ?? null,
      requestedMoveOutDate: req.requestedMoveOutDate,
      status: req.status ?? "open",
      tenantName: tenant?.name ?? "Tenant",
      propertyName: property?.name ?? "",
      assignedRoomNumber,
      createdAt: req._creationTime,
    };
  },
});

export const markMoveOutRequestApproved = mutation({
  args: { moveOutRequestId: v.id("moveOutRequests") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) throw new Error("Unauthenticated");

    const operator = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!operator) throw new Error("User not found");

    const req = await ctx.db.get(args.moveOutRequestId);
    if (!req) throw new Error("Move-out request not found");

    const property = await ctx.db.get(req.propertyId);
    if (!property || property.userId !== operator._id) {
      throw new Error("Not authorised");
    }

    await ctx.db.patch(args.moveOutRequestId, { status: "approved" });

    // Store move-out date on the application record.
    if (req.applicationId) {
      await ctx.db.patch(req.applicationId, {
        moveOutDate: req.requestedMoveOutDate,
      });
    }

    await ctx.db.insert("notifications", {
      tenantUserId: req.tenantUserId,
      type: "move_out_approved",
      title: "Move-out request approved",
      body: `Your move-out request for ${req.requestedMoveOutDate} has been approved by your property manager.`,
      read: false,
      refId: args.moveOutRequestId,
    });
  },
});

export const markMoveOutRequestRejected = mutation({
  args: { moveOutRequestId: v.id("moveOutRequests") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) throw new Error("Unauthenticated");

    const operator = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!operator) throw new Error("User not found");

    const req = await ctx.db.get(args.moveOutRequestId);
    if (!req) throw new Error("Move-out request not found");

    const property = await ctx.db.get(req.propertyId);
    if (!property || property.userId !== operator._id) {
      throw new Error("Not authorised");
    }

    await ctx.db.patch(args.moveOutRequestId, { status: "rejected" });

    await ctx.db.insert("notifications", {
      tenantUserId: req.tenantUserId,
      type: "move_out_rejected",
      title: "Move-out request not approved",
      body: `Your move-out request for ${req.requestedMoveOutDate} could not be approved. Please contact your property manager for details.`,
      read: false,
      refId: args.moveOutRequestId,
    });
  },
});
