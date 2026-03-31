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

export const submitShiftRequest = mutation({
  args: {
    propertyId: v.id("properties"),
    applicationId: v.optional(v.id("tenantMoveInApplications")),
    currentRoomNumber: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireTenantUser(ctx);

    const currentRoomNumber = args.currentRoomNumber.trim();
    const reason = args.reason.trim();
    if (!currentRoomNumber) throw new Error("Current room number is required.");
    if (!reason) throw new Error("Reason is required.");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found.");

    // Validate caller-supplied applicationId — verify ownership and property match.
    let validatedApplicationId: typeof args.applicationId = undefined;
    if (args.applicationId) {
      const app = await ctx.db.get(args.applicationId);
      if (!app) throw new Error("Application not found.");
      if (app.tenantUserId !== user._id)
        throw new Error("Not authorised: application does not belong to you.");
      if (app.propertyId !== args.propertyId)
        throw new Error("Not authorised: application does not match the given property.");
      validatedApplicationId = app._id;
    }

    const shiftRequestId = await ctx.db.insert("shiftRequests", {
      tenantUserId: user._id,
      propertyId: args.propertyId,
      applicationId: validatedApplicationId,
      currentRoomNumber,
      reason,
      status: "open",
    });

    return { shiftRequestId };
  },
});

export const getShiftRequestById = query({
  args: { shiftRequestId: v.id("shiftRequests") },
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

    const shiftRequest = await ctx.db.get(args.shiftRequestId);
    if (!shiftRequest) return null;

    const property = await ctx.db.get(shiftRequest.propertyId);

    const isTenant = caller._id === shiftRequest.tenantUserId;
    const isOperator = !!property && property.userId === caller._id;
    if (!isTenant && !isOperator) return null;

    const tenant = await ctx.db.get(shiftRequest.tenantUserId);

    // Find all rooms assigned to current tenants in this property
    const apps = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_property", (q) => q.eq("propertyId", shiftRequest.propertyId))
      .take(500);

    const assignedRoomIds = new Set<string>();
    for (const app of apps) {
      // Exclude the requesting tenant's own assigned room so they can pick another
      if (app.tenantUserId === shiftRequest.tenantUserId) continue;
      if (app.assignedRoomId) assignedRoomIds.add(app.assignedRoomId as string);
    }

    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_property", (q) => q.eq("propertyId", shiftRequest.propertyId))
      .take(200);

    const availableRooms = rooms
      .filter((r) => !assignedRoomIds.has(r._id as string))
      // Exclude their current room (they want to move away from it)
      .filter((r) => r.roomNumber !== shiftRequest.currentRoomNumber)
      .map((r) => ({ roomId: r._id as string, roomLabel: r.roomNumber }));

    return {
      shiftRequestId: shiftRequest._id,
      applicationId: shiftRequest.applicationId ?? null,
      currentRoomNumber: shiftRequest.currentRoomNumber,
      reason: shiftRequest.reason,
      status: shiftRequest.status ?? "open",
      tenantName: tenant?.name ?? "Tenant",
      propertyName: property?.name ?? "",
      createdAt: shiftRequest._creationTime,
      availableRooms,
    };
  },
});

export const assignRoomForShiftRequest = mutation({
  args: {
    shiftRequestId: v.id("shiftRequests"),
    roomId: v.id("rooms"),
  },
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

    const shiftRequest = await ctx.db.get(args.shiftRequestId);
    if (!shiftRequest) throw new Error("Shift request not found");

    const property = await ctx.db.get(shiftRequest.propertyId);
    if (!property || property.userId !== operator._id) {
      throw new Error("Not authorised to update this shift request");
    }

    const room = await ctx.db.get(args.roomId);
    if (!room || room.propertyId !== shiftRequest.propertyId) {
      throw new Error("Room not found in this property");
    }

    // Check the room is not already taken
    const apps = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_property", (q) => q.eq("propertyId", shiftRequest.propertyId))
      .take(500);
    for (const app of apps) {
      if (app.tenantUserId === shiftRequest.tenantUserId) continue;
      if (app.assignedRoomId === args.roomId) {
        throw new Error(`Room ${room.roomNumber} is already occupied.`);
      }
    }

    // Update the tenant's move-in application with the new room
    if (shiftRequest.applicationId) {
      await ctx.db.patch(shiftRequest.applicationId, {
        assignedRoomId: args.roomId,
        assignedRoomNumber: room.roomNumber,
        assignedAt: Date.now(),
      });
    }

    await ctx.db.patch(args.shiftRequestId, { status: "approved" });

    await ctx.db.insert("notifications", {
      tenantUserId: shiftRequest.tenantUserId,
      type: "shift_request_approved",
      title: "Shift request approved",
      body: `Your shift request has been approved. You've been assigned to room ${room.roomNumber}.`,
      read: false,
      refId: args.shiftRequestId,
    });

    return { assignedRoomNumber: room.roomNumber };
  },
});

export const markShiftRequestApproved = mutation({
  args: { shiftRequestId: v.id("shiftRequests") },
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

    const shiftRequest = await ctx.db.get(args.shiftRequestId);
    if (!shiftRequest) throw new Error("Shift request not found");

    const property = await ctx.db.get(shiftRequest.propertyId);
    if (!property || property.userId !== operator._id) {
      throw new Error("Not authorised to update this shift request");
    }

    await ctx.db.patch(args.shiftRequestId, { status: "approved" });

    await ctx.db.insert("notifications", {
      tenantUserId: shiftRequest.tenantUserId,
      type: "shift_request_approved",
      title: "Shift request approved",
      body: `Your request to shift from room ${shiftRequest.currentRoomNumber} has been approved. Your property manager will coordinate the room change.`,
      read: false,
      refId: args.shiftRequestId,
    });
  },
});

export const markShiftRequestRejected = mutation({
  args: { shiftRequestId: v.id("shiftRequests") },
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

    const shiftRequest = await ctx.db.get(args.shiftRequestId);
    if (!shiftRequest) throw new Error("Shift request not found");

    const property = await ctx.db.get(shiftRequest.propertyId);
    if (!property || property.userId !== operator._id) {
      throw new Error("Not authorised to update this shift request");
    }

    await ctx.db.patch(args.shiftRequestId, { status: "rejected" });

    await ctx.db.insert("notifications", {
      tenantUserId: shiftRequest.tenantUserId,
      type: "shift_request_rejected",
      title: "Shift request not approved",
      body: `Your request to shift from room ${shiftRequest.currentRoomNumber} could not be accommodated at this time. Please contact your property manager for more details.`,
      read: false,
      refId: args.shiftRequestId,
    });
  },
});
