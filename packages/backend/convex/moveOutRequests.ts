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

    // Compute agreement end timestamp (ms) when we have both inputs.
    let agreementEndsAt: number | null = null;
    if (assignedAt != null && months != null) {
      const d = new Date(assignedAt);
      d.setMonth(d.getMonth() + months);
      agreementEndsAt = d.getTime();
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

    // Server-side validation: ensure move-out date is not before agreement expiry.
    if (args.applicationId) {
      const app = await ctx.db.get(args.applicationId);
      if (app) {
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
          const endDate = new Date(assignedAt);
          endDate.setMonth(endDate.getMonth() + months);

          // Parse DD/MM/YYYY
          const parts = requestedMoveOutDate.split("/");
          if (parts.length === 3) {
            const [dd, mm, yyyy] = parts;
            const moveOutTs = new Date(
              parseInt(yyyy, 10),
              parseInt(mm, 10) - 1,
              parseInt(dd, 10),
            ).getTime();
            if (moveOutTs < endDate.getTime()) {
              throw new Error(
                `Move-out date must be on or after your agreement end date (${endDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}).`,
              );
            }
          }
        }
      }
    }

    const moveOutRequestId = await ctx.db.insert("moveOutRequests", {
      tenantUserId: user._id,
      propertyId: args.propertyId,
      applicationId: args.applicationId,
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

    const req = await ctx.db.get(args.moveOutRequestId);
    if (!req) return null;

    const tenant = await ctx.db.get(req.tenantUserId);
    const property = await ctx.db.get(req.propertyId);

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
