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

export const submitLateEntryRequest = mutation({
  args: {
    propertyId: v.id("properties"),
    applicationId: v.optional(v.id("tenantMoveInApplications")),
    entryTime: v.string(),
    reason: v.string(),
    emergencyContact: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireTenantUser(ctx);

    const entryTime = args.entryTime.trim();
    const reason = args.reason.trim();
    const emergencyContact = args.emergencyContact.trim();
    if (!entryTime) throw new Error("Entry time is required.");
    if (!reason) throw new Error("Reason is required.");
    if (!emergencyContact) throw new Error("Emergency contact is required.");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found.");

    let validatedApplicationId: typeof args.applicationId = undefined;
    if (args.applicationId) {
      const app = await ctx.db.get(args.applicationId);
      if (!app) throw new Error("Application not found.");
      if (app.tenantUserId !== user._id)
        throw new Error("Not authorised: application does not belong to you.");
      if (app.propertyId !== args.propertyId)
        throw new Error("Not authorised: application does not match the given property.");
      const isActive = app.status === "submitted" || app.assignedRoomId != null;
      if (!isActive)
        throw new Error("Not authorised: application is not currently active.");
      validatedApplicationId = app._id;
    } else {
      // No applicationId supplied — verify the caller has an active move-in application
      // for this property before allowing the request.
      const apps = await ctx.db
        .query("tenantMoveInApplications")
        .withIndex("by_tenant_and_property", (q) =>
          q.eq("tenantUserId", user._id).eq("propertyId", args.propertyId),
        )
        .collect();
      const active = apps.find(
        (a) => a.status === "submitted" || a.assignedRoomId != null,
      );
      if (!active)
        throw new Error(
          "Not authorised: no active move-in application found for this property.",
        );
    }

    const lateEntryRequestId = await ctx.db.insert("lateEntryRequests", {
      tenantUserId: user._id,
      propertyId: args.propertyId,
      applicationId: validatedApplicationId,
      entryTime,
      reason,
      emergencyContact,
      status: "open",
    });

    // Notify the property operator
    const tenantName = user.name ?? "A tenant";
    await ctx.db.insert("operatorNotifications", {
      operatorUserId: property.userId,
      type: "late_entry",
      title: "Late Entry Request",
      body: `${tenantName} has requested late entry at ${entryTime}. Reason: ${reason}. Emergency contact: ${emergencyContact}.`,
      read: false,
      refId: lateEntryRequestId,
    });

    return { lateEntryRequestId };
  },
});

/** Operator: fetch full details of a late entry request by its ID. */
export const getLateEntryRequestById = query({
  args: { lateEntryRequestId: v.id("lateEntryRequests") },
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

    const req = await ctx.db.get(args.lateEntryRequestId);
    if (!req) return null;

    const property = await ctx.db.get(req.propertyId);
    if (!property || property.userId !== caller._id) return null;

    const tenant = await ctx.db.get(req.tenantUserId);

    return {
      lateEntryRequestId: req._id,
      entryTime: req.entryTime,
      reason: req.reason,
      emergencyContact: req.emergencyContact,
      status: req.status ?? "open",
      tenantName: tenant?.name ?? "Tenant",
      tenantEmail: tenant?.email ?? null,
      propertyName: property.name ?? "",
      createdAt: req._creationTime,
    };
  },
});
