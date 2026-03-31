import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

/** Operator: mark all their notifications as read. */
export const markAllOperatorNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) throw new Error("User not found");

    const unread = await ctx.db
      .query("operatorNotifications")
      .withIndex("by_operator", (q) => q.eq("operatorUserId", user._id))
      .filter((q) => q.eq(q.field("read"), false))
      .take(200);

    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
  },
});
