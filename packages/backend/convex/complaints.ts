import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

async function requireTenantUser(ctx: MutationCtx) {
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
    throw new Error("User not found. Sync your account and try again.");
  }
  return user;
}

export const generateComplaintImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireTenantUser(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const submitComplaint = mutation({
  args: {
    propertyId: v.id("properties"),
    applicationId: v.optional(v.id("tenantMoveInApplications")),
    problemTitle: v.string(),
    description: v.string(),
    priority: v.union(v.literal("High"), v.literal("Medium"), v.literal("Low")),
    imageFileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await requireTenantUser(ctx);

    const problemTitle = args.problemTitle.trim();
    const description = args.description.trim();
    if (!problemTitle) throw new Error("Problem title is required.");
    if (!description) throw new Error("Description is required.");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found.");

    const complaintId = await ctx.db.insert("complaints", {
      tenantUserId: user._id,
      propertyId: args.propertyId,
      applicationId: args.applicationId,
      problemTitle,
      description,
      priority: args.priority,
      imageFileId: args.imageFileId,
      status: "open",
    });

    return { complaintId };
  },
});

/** Get tenant's active application for their current property (to attach complaints). */
export const getTenantActiveApplication = query({
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
      .collect();

    // Return the most recent submitted/assigned application
    const active = apps.find(
      (a) => a.status === "submitted" || a.assignedRoomId != null,
    );
    if (!active) return null;

    return {
      applicationId: active._id,
      propertyId: active.propertyId,
    };
  },
});

export const getTenantEmergencyContacts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return [];

    const apps = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_tenant", (q) => q.eq("tenantUserId", user._id))
      .collect();

    const active = apps.find(
      (a) => a.status === "submitted" || a.assignedRoomId != null,
    );
    return active?.emergencyContacts ?? [];
  },
});

/** For operator task details: get complaint by its own ID (passed as the task's applicationId param). */
export const getComplaintById = query({
  args: { complaintId: v.id("complaints") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return null;

    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) return null;

    const tenant = await ctx.db.get(complaint.tenantUserId);
    const property = await ctx.db.get(complaint.propertyId);

    const imageUrl = complaint.imageFileId
      ? await ctx.storage.getUrl(complaint.imageFileId)
      : null;

    return {
      complaintId: complaint._id,
      problemTitle: complaint.problemTitle,
      description: complaint.description,
      priority: complaint.priority,
      status: complaint.status ?? "open",
      imageUrl,
      tenantName: tenant?.name ?? "Tenant",
      propertyName: property?.name ?? "",
      createdAt: complaint._creationTime,
    };
  },
});

/** Operator marks a complaint as resolved — also sends a notification to the tenant. */
export const markComplaintResolved = mutation({
  args: { complaintId: v.id("complaints") },
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

    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new Error("Complaint not found");

    // Verify the complaint belongs to one of this operator's properties.
    const property = await ctx.db.get(complaint.propertyId);
    if (!property || property.userId !== operator._id) {
      throw new Error("Not authorised to resolve this complaint");
    }

    await ctx.db.patch(args.complaintId, { status: "pending_confirmation" });

    // Notify the tenant to confirm.
    await ctx.db.insert("notifications", {
      tenantUserId: complaint.tenantUserId,
      type: "complaint_resolved",
      title: "Complaint resolved",
      body: `Your complaint "${complaint.problemTitle}" has been marked as resolved by your property manager. Please confirm if the issue is fixed.`,
      read: false,
      refId: args.complaintId,
    });
  },
});

/** Tenant confirms the complaint is resolved — sets status to "resolved" so it disappears from operator tasks. */
export const confirmComplaintResolved = mutation({
  args: { complaintId: v.id("complaints") },
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

    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new Error("Complaint not found");
    if (complaint.tenantUserId !== user._id) throw new Error("Not authorised");

    await ctx.db.patch(args.complaintId, { status: "resolved" });
  },
});

/** Tenant: get their notifications (newest first). */
export const getTenantNotifications = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return { items: [], unreadCount: 0 };

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return { items: [], unreadCount: 0 };

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_tenant", (q) => q.eq("tenantUserId", user._id))
      .order("desc")
      .take(50);

    const unreadCount = notifications.filter((n) => !n.read).length;

    return {
      items: notifications.map((n) => ({
        id: n._id,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read ?? false,
        refId: n.refId ?? null,
        createdAt: n._creationTime,
      })),
      unreadCount,
    };
  },
});

/** Tenant: mark a single notification as read. */
export const markNotificationRead = mutation({
  args: { notificationId: v.id("notifications") },
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

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.tenantUserId !== user._id) {
      throw new Error("Notification not found");
    }

    await ctx.db.patch(args.notificationId, { read: true });
  },
});

/** Tenant: mark all notifications as read. */
export const markAllNotificationsRead = mutation({
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
      .query("notifications")
      .withIndex("by_tenant", (q) => q.eq("tenantUserId", user._id))
      .filter((q) => q.eq(q.field("read"), false))
      .take(100);

    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { read: true })));
  },
});

/** For operator tasks list: get all open complaint tasks for operator's properties. */
export const getComplaintTasksForOperator = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.tokenIdentifier) return { items: [] };

    const operator = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!operator) return { items: [] };

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_user", (q) => q.eq("userId", operator._id))
      .take(200);

    const propertyIds = new Set(properties.map((p) => p._id as string));

    type ComplaintTask = {
      complaintId: string;
      applicationId: string | null;
      priority: "High" | "Medium" | "Low";
      problemTitle: string;
      tenantName: string;
      createdAt: number;
    };

    const collected: ComplaintTask[] = [];

    for (const property of properties) {
      const complaints = await ctx.db
        .query("complaints")
        .withIndex("by_property", (q) => q.eq("propertyId", property._id))
        .order("desc")
        .take(100);

      for (const c of complaints) {
        if (c.status === "resolved") continue;
        if (!propertyIds.has(c.propertyId as string)) continue;

        const tenant = await ctx.db.get(c.tenantUserId);
        collected.push({
          complaintId: c._id,
          applicationId: c.applicationId ?? null,
          priority: c.priority,
          problemTitle: c.problemTitle,
          tenantName: tenant?.name ?? "Tenant",
          createdAt: c._creationTime,
        });

        if (collected.length >= limit) break;
      }
      if (collected.length >= limit) break;
    }

    collected.sort((a, b) => b.createdAt - a.createdAt);

    return { items: collected.slice(0, limit) };
  },
});
