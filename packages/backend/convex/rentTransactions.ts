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
  if (!user) throw new Error("User not found.");
  return user;
}

function parseDurationMonths(duration: string): number | null {
  const s = duration.trim().toLowerCase();
  const monthMatch = s.match(/^(\d+)\s*month/);
  if (monthMatch) return parseInt(monthMatch[1], 10);
  const yearMatch = s.match(/^(\d+)\s*year/);
  if (yearMatch) return parseInt(yearMatch[1], 10) * 12;
  return null;
}

/** Returns rent info needed to show extend-stay options. */
export const getTenantRentInfo = query({
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

    // Get rent amount from the selected room option.
    let rentAmount: number | null = null;
    if (active.selectedRoomOptionId) {
      const roomOption = await ctx.db.get(active.selectedRoomOptionId);
      rentAmount = roomOption?.rentAmount ?? null;
    }
    // Fall back to any room option in the property.
    if (rentAmount == null) {
      const opts = await ctx.db
        .query("roomOptions")
        .withIndex("by_property_and_category", (q) =>
          q.eq("propertyId", active.propertyId),
        )
        .take(10);
      rentAmount = opts.find((o) => o.rentAmount != null)?.rentAmount ?? null;
    }

    const agreementDuration =
      active.onboardingAgreementDuration ?? null;
    const renewalMonths = agreementDuration
      ? parseDurationMonths(agreementDuration)
      : null;

    return {
      applicationId: active._id,
      propertyId: active.propertyId,
      rentAmount,
      agreementDuration,
      renewalMonths,
    };
  },
});

export const submitExtendStayPayment = mutation({
  args: {
    applicationId: v.id("tenantMoveInApplications"),
    propertyId: v.id("properties"),
    type: v.union(v.literal("monthly"), v.literal("quarterly"), v.literal("renewal")),
  },
  handler: async (ctx, args) => {
    const user = await requireTenantUser(ctx);

    const app = await ctx.db.get(args.applicationId);
    if (!app || app.tenantUserId !== user._id) throw new Error("Application not found.");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found.");

    // Resolve rent amount.
    let rentAmount: number | null = null;
    if (app.selectedRoomOptionId) {
      const roomOption = await ctx.db.get(app.selectedRoomOptionId);
      rentAmount = roomOption?.rentAmount ?? null;
    }
    if (rentAmount == null) {
      const opts = await ctx.db
        .query("roomOptions")
        .withIndex("by_property_and_category", (q) =>
          q.eq("propertyId", app.propertyId),
        )
        .take(10);
      rentAmount = opts.find((o) => o.rentAmount != null)?.rentAmount ?? null;
    }
    if (!rentAmount) throw new Error("Could not determine rent amount for this property.");

    const agreementDuration = app.onboardingAgreementDuration ?? null;
    const renewalMonths = agreementDuration ? parseDurationMonths(agreementDuration) : null;

    let months: number;
    let description: string;

    if (args.type === "monthly") {
      months = 1;
      description = "Monthly rent payment";
    } else if (args.type === "quarterly") {
      months = 3;
      description = "Quarterly rent payment (3 months)";
    } else {
      // renewal
      if (!renewalMonths) throw new Error("Could not determine previous agreement duration for renewal.");
      months = renewalMonths;
      description = `Agreement renewal (${agreementDuration})`;
    }

    const amount = rentAmount * months;

    const txId = await ctx.db.insert("rentTransactions", {
      tenantUserId: user._id,
      propertyId: args.propertyId,
      applicationId: args.applicationId,
      type: args.type,
      months,
      amount,
      status: "paid",
      description,
    });

    return { transactionId: txId, amount, months, description };
  },
});
