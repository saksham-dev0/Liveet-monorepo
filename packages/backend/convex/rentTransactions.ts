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

    // Resolve rent amount: prefer the selected room option, then fall back to
    // the assigned room's option. Never pick an arbitrary property-wide option.
    let rentAmount: number | null = null;
    if (active.selectedRoomOptionId) {
      const roomOption = await ctx.db.get(active.selectedRoomOptionId);
      rentAmount = roomOption?.rentAmount ?? null;
    }
    if (rentAmount == null && active.assignedRoomId) {
      const room = await ctx.db.get(active.assignedRoomId);
      if (room?.roomOptionId) {
        const roomOption = await ctx.db.get(room.roomOptionId);
        rentAmount = roomOption?.rentAmount ?? null;
      }
    }
    if (rentAmount == null) return null;

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

    const property = await ctx.db.get(app.propertyId);
    if (!property) throw new Error("Property not found.");

    // Resolve rent amount: prefer the selected room option, then fall back to
    // the assigned room's option. Never pick an arbitrary property-wide option.
    let rentAmount: number | null = null;
    if (app.selectedRoomOptionId) {
      const roomOption = await ctx.db.get(app.selectedRoomOptionId);
      rentAmount = roomOption?.rentAmount ?? null;
    }
    if (rentAmount == null && app.assignedRoomId) {
      const room = await ctx.db.get(app.assignedRoomId);
      if (room?.roomOptionId) {
        const roomOption = await ctx.db.get(room.roomOptionId);
        rentAmount = roomOption?.rentAmount ?? null;
      }
    }
    if (!rentAmount) throw new Error("Could not determine rent amount: no room option is linked to your application.");

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
      propertyId: app.propertyId,
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

/**
 * Operator sends an extend-stay payment link to a tenant.
 * Creates a pending rentTransaction and notifies the tenant.
 */
export const sendExtendStayPaymentLink = mutation({
  args: {
    applicationId: v.id("tenantMoveInApplications"),
    months: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.months < 1 || args.months > 60) {
      throw new Error("Duration must be between 1 and 60 months.");
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) throw new Error("Unauthenticated");

    const operator = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!operator) throw new Error("User not found");

    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    const property = await ctx.db.get(app.propertyId);
    if (!property || property.userId !== operator._id) {
      throw new Error("Not authorised");
    }

    // Resolve rent amount
    let rentAmount: number | null = null;
    if (app.selectedRoomOptionId) {
      const roomOption = await ctx.db.get(app.selectedRoomOptionId);
      rentAmount = roomOption?.rentAmount ?? null;
    }
    if (rentAmount == null && app.assignedRoomId) {
      const room = await ctx.db.get(app.assignedRoomId);
      if (room?.roomOptionId) {
        const roomOption = await ctx.db.get(room.roomOptionId);
        rentAmount = roomOption?.rentAmount ?? null;
      }
    }
    if (!rentAmount) {
      throw new Error("Could not determine rent amount for this tenant.");
    }

    const amount = rentAmount * args.months;
    const type: "monthly" | "quarterly" | "renewal" =
      args.months === 1
        ? "monthly"
        : args.months === 3
          ? "quarterly"
          : "renewal";
    const description =
      args.months === 1
        ? "Monthly rent payment"
        : `Extend stay payment (${args.months} months)`;

    // Create a pending transaction
    const txId = await ctx.db.insert("rentTransactions", {
      tenantUserId: app.tenantUserId,
      propertyId: app.propertyId,
      applicationId: args.applicationId,
      type,
      months: args.months,
      amount,
      status: "pending",
      description,
    });

    // Notify the tenant
    const propertyName = property.name ?? "your property";
    const roomInfo = app.assignedRoomNumber
      ? ` (Room ${app.assignedRoomNumber})`
      : "";

    await ctx.db.insert("notifications", {
      tenantUserId: app.tenantUserId,
      type: "extend_stay_payment",
      title: "Extend Stay — Payment Required",
      body: `Your stay at ${propertyName}${roomInfo} has been extended by ${args.months} month${args.months > 1 ? "s" : ""}. Amount due: ₹${amount.toLocaleString("en-IN")}. Please complete the payment to confirm.`,
      read: false,
      refId: txId,
    });

    return { transactionId: txId, amount, months: args.months };
  },
});

/**
 * Tenant pays an existing pending extend-stay transaction created by the
 * operator via sendExtendStayPaymentLink.
 */
export const payPendingExtendStayTransaction = mutation({
  args: {
    transactionId: v.id("rentTransactions"),
  },
  handler: async (ctx, args) => {
    const user = await requireTenantUser(ctx);
    const tx = await ctx.db.get(args.transactionId);
    if (!tx || tx.tenantUserId !== user._id) throw new Error("Transaction not found.");
    if (tx.status !== "pending") throw new Error("This transaction has already been processed.");
    await ctx.db.patch(args.transactionId, { status: "paid" });

    // Update agreement duration now that payment is confirmed
    await ctx.db.patch(tx.applicationId, {
      onboardingAgreementDuration: `${tx.months} month${tx.months > 1 ? "s" : ""}`,
    });

    return { amount: tx.amount, description: tx.description };
  },
});
