import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/** Operator: get their notifications (newest first). */
export const getOperatorNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return { items: [] };

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return { items: [] };

    const notifications = await ctx.db
      .query("operatorNotifications")
      .withIndex("by_operator", (q) => q.eq("operatorUserId", user._id))
      .order("desc")
      .take(args.limit ?? 50);

    return {
      items: notifications.map((n) => ({
        _id: n._id,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read ?? false,
        refId: n.refId ?? null,
        createdAt: n._creationTime,
      })),
    };
  },
});

/**
 * Operator sends a rent reminder notification to a tenant for a pending payment.
 * Verifies that the operator owns the property associated with the application.
 */
export const sendRentReminder = mutation({
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
    if (!operator) throw new Error("User not found");

    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    // Verify operator owns the property
    const property = await ctx.db.get(app.propertyId);
    if (!property || property.userId !== operator._id) {
      throw new Error("Unauthorized");
    }

    const tenantName = app.legalNameAsOnId ?? "Tenant";
    const propertyName = property.name ?? "your property";
    const roomInfo = app.assignedRoomNumber ? ` (Room ${app.assignedRoomNumber})` : "";

    await ctx.db.insert("notifications", {
      tenantUserId: app.tenantUserId,
      type: "rent_reminder",
      title: "Rent Payment Reminder",
      body: `Your rent for ${propertyName}${roomInfo} is due. Please make the payment at your earliest convenience.`,
      read: false,
      refId: args.applicationId,
    });
  },
});

/** Operator: mark all their notifications as read.
 *  When notificationIds is provided, only those specific rows are patched
 *  (ownership is verified). Otherwise all unread rows are patched in batches.
 */
export const markAllOperatorNotificationsRead = mutation({
  args: {
    notificationIds: v.optional(v.array(v.id("operatorNotifications"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) throw new Error("User not found");

    if (args.notificationIds) {
      for (const id of args.notificationIds) {
        const n = await ctx.db.get(id);
        if (n && n.operatorUserId === user._id && n.read !== true) {
          await ctx.db.patch(id, { read: true });
        }
      }
      return;
    }

    let batch;
    do {
      batch = await ctx.db
        .query("operatorNotifications")
        .withIndex("by_operator", (q) => q.eq("operatorUserId", user._id))
        .filter((q) => q.neq(q.field("read"), true))
        .take(200);

      for (const n of batch) {
        await ctx.db.patch(n._id, { read: true });
      }
    } while (batch.length === 200);
  },
});
