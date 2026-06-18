import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function resolveOperatorAndProperty(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();
  if (!user) throw new Error("User not found");

  const property = await ctx.db
    .query("properties")
    .withIndex("by_operatorId", (q: any) => q.eq("operatorId", user._id))
    .first();
  if (!property) throw new Error("Property not found");

  return { user, property };
}

export const getTenants = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return [];

    const property = await ctx.db
      .query("properties")
      .withIndex("by_operatorId", (q: any) => q.eq("operatorId", user._id))
      .first();
    if (!property) return [];

    const tenants = await ctx.db
      .query("tenants")
      .withIndex("by_propertyId", (q: any) => q.eq("propertyId", property._id))
      .collect();

    const floors = await ctx.db
      .query("floors")
      .withIndex("by_propertyId", (q: any) => q.eq("propertyId", property._id))
      .collect();
    const floorMap = new Map(floors.map((f: any) => [f._id, f]));

    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_propertyId", (q: any) => q.eq("propertyId", property._id))
      .collect();
    const roomMap = new Map(rooms.map((r: any) => [r._id, r]));

    return tenants.map((t: any) => {
      const room = t.roomId ? roomMap.get(t.roomId) : null;
      const floor = room ? floorMap.get(room.floorId) : null;
      return {
        _id: t._id,
        studentName: t.studentName,
        studentPhone: t.studentPhone,
        studentEmail: t.studentEmail,
        course: t.course,
        parentName: t.parentName,
        parentPhone: t.parentPhone,
        rent: t.rent,
        security: t.security,
        advance: t.advance,
        booking: t.booking,
        maintenance: t.maintenance,
        customCharges: t.customCharges,
        moveInAmount: t.moveInAmount,
        paymentStatus: t.paymentStatus,
        paymentHistory: t.paymentHistory ?? [],
        createdAt: t.createdAt,
        roomNumber: room?.roomNumber ?? null,
        roomType: room?.type ?? null,
        floorLabel: floor?.short ?? floor?.label ?? null,
        propertyName: property.name,
      };
    });
  },
});

export const getAvailableRooms = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return [];

    const property = await ctx.db
      .query("properties")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", user._id))
      .first();
    if (!property) return [];

    const floors = await ctx.db
      .query("floors")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", property._id))
      .collect();

    const floorMap = new Map(floors.map((f) => [f._id, f]));

    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", property._id))
      .collect();

    return rooms.map((r) => ({
      id: r._id,
      roomNumber: r.roomNumber,
      type: r.type,
      capacity: r.capacity,
      floorLabel: floorMap.get(r.floorId)?.short ?? floorMap.get(r.floorId)?.label ?? "?",
      rent: r.rent,
      deposit: r.deposit,
    }));
  },
});

export const getTenantById = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user || user._id !== tenant.operatorId) return null;

    const room = tenant.roomId ? await ctx.db.get(tenant.roomId) : null;
    let floorLabel: string | null = null;
    if (room?.floorId) {
      const floor = await ctx.db.get(room.floorId);
      floorLabel = floor?.short ?? floor?.label ?? null;
    }

    return {
      ...tenant,
      roomNumber: room?.roomNumber ?? null,
      roomType: room?.type ?? null,
      floorLabel,
    };
  },
});

export const recordPayment = mutation({
  args: {
    tenantId: v.id("tenants"),
    amountCollected: v.number(),
    paymentStatus: v.union(v.literal("paid"), v.literal("partial"), v.literal("pending")),
    note: v.optional(v.string()),
    items: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Tenant not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user || user._id !== tenant.operatorId) throw new Error("Unauthorized");

    const now = Date.now();
    const newEntry = {
      id: `pay_${now}`,
      amount: args.amountCollected,
      status: args.paymentStatus,
      note: args.note ?? "Payment recorded",
      items: args.items ?? [],
      createdAt: now,
    };

    await ctx.db.patch(args.tenantId, {
      paymentStatus: args.paymentStatus,
      moveInAmount: (tenant.moveInAmount ?? 0) + args.amountCollected,
      paymentHistory: [...(tenant.paymentHistory ?? []), newEntry],
    });
  },
});

export const addTenant = mutation({
  args: {
    studentName: v.string(),
    studentPhone: v.string(),
    studentEmail: v.optional(v.string()),
    course: v.optional(v.string()),
    parentName: v.optional(v.string()),
    parentPhone: v.optional(v.string()),
    parentEmail: v.optional(v.string()),
    roomId: v.optional(v.id("rooms")),
    rent: v.optional(v.number()),
    advance: v.optional(v.number()),
    security: v.optional(v.number()),
    booking: v.optional(v.number()),
    maintenance: v.optional(v.number()),
    customCharges: v.optional(
      v.array(v.object({ id: v.string(), label: v.string(), amount: v.number() }))
    ),
    moveInAmount: v.optional(v.number()),
    bookingItemLabels: v.optional(v.array(v.string())),
    paymentStatus: v.union(
      v.literal("paid"),
      v.literal("partial"),
      v.literal("pending")
    ),
  },
  handler: async (ctx, args) => {
    const { user, property } = await resolveOperatorAndProperty(ctx);

    if (args.roomId) {
      const room = await ctx.db.get(args.roomId);
      if (!room || room.propertyId !== property._id) throw new Error("Room does not belong to this property");
    }

    const now = Date.now();
    const paymentHistory =
      args.moveInAmount && args.moveInAmount > 0
        ? [
            {
              id: `booking_${now}`,
              amount: args.moveInAmount,
              status: args.paymentStatus,
              note: "Booking payment",
              items: args.bookingItemLabels ?? [],
              createdAt: now,
            },
          ]
        : [];

    const tenantId = await ctx.db.insert("tenants", {
      propertyId: property._id,
      operatorId: user._id,
      roomId: args.roomId,
      studentName: args.studentName,
      studentPhone: args.studentPhone,
      studentEmail: args.studentEmail,
      course: args.course,
      parentName: args.parentName,
      parentPhone: args.parentPhone,
      parentEmail: args.parentEmail,
      rent: args.rent,
      advance: args.advance,
      security: args.security,
      booking: args.booking,
      maintenance: args.maintenance,
      customCharges: args.customCharges,
      moveInAmount: args.moveInAmount,
      paymentStatus: args.paymentStatus,
      paymentHistory,
      createdAt: now,
    });

    return tenantId;
  },
});

async function getLatestBookingForUser(db: any, userId: any) {
  return db
    .query("bookingRequests")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();
}

export const submitLateEntry = mutation({
  args: {
    date: v.string(),
    time: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.date.trim()) throw new Error("Date is required");
    if (!args.time.trim()) throw new Error("Time is required");
    if (!args.reason.trim()) throw new Error("Reason is required");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) throw new Error("User not found");

    const booking = await getLatestBookingForUser(ctx.db, user._id);
    if (!booking) throw new Error("No booking found");
    if (booking.status !== "accepted") throw new Error("Booking not accepted");

    const property = await ctx.db.get(booking.propertyId);
    if (!property) throw new Error("Property not found");

    return await ctx.db.insert("lateEntryRequests", {
      userId: user._id,
      propertyId: booking.propertyId,
      operatorId: property.operatorId,
      date: args.date,
      time: args.time,
      reason: args.reason,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const getMyTenantDetails = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return null;

    const booking = await getLatestBookingForUser(ctx.db, user._id);
    if (!booking || booking.status !== "accepted") return null;

    const property = await ctx.db.get(booking.propertyId);
    if (!property) return null;

    const tenants = await ctx.db
      .query("tenants")
      .withIndex("by_propertyId", (q: any) => q.eq("propertyId", booking.propertyId))
      .collect();
    const tenant = tenants.find((t: any) => t.studentPhone === booking.studentPhone);

    let room: { roomNumber: string; type: string; rent?: number } | null = null;
    if (tenant?.roomId) {
      const r = await ctx.db.get(tenant.roomId);
      if (r) room = { roomNumber: r.roomNumber, type: r.type, rent: r.rent };
    }

    return {
      studentName: booking.studentName,
      studentPhone: booking.studentPhone ?? null,
      course: tenant?.course ?? null,
      propertyName: property.name,
      propertyCity: property.city ?? null,
      propertyState: property.state ?? null,
      moveInDate: booking.moveInDate,
      rent: tenant?.rent ?? null,
      room,
    };
  },
});

export const getAvailableRoomsForTenant = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return [];

    const booking = await getLatestBookingForUser(ctx.db, user._id);
    if (!booking || booking.status !== "accepted") return [];

    const floors = await ctx.db
      .query("floors")
      .withIndex("by_propertyId", (q: any) => q.eq("propertyId", booking.propertyId))
      .collect();
    const floorMap = new Map(floors.map((f: any) => [f._id, f]));

    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_propertyId", (q: any) => q.eq("propertyId", booking.propertyId))
      .collect();

    return rooms.map((r: any) => ({
      id: r._id,
      roomNumber: r.roomNumber,
      type: r.type,
      capacity: r.capacity,
      floorLabel: floorMap.get(r.floorId)?.short ?? floorMap.get(r.floorId)?.label ?? "?",
      rent: r.rent,
    }));
  },
});

export const submitRoomChange = mutation({
  args: {
    preferredRoomNumber: v.optional(v.string()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.reason.trim()) throw new Error("Reason is required");
    if (args.preferredRoomNumber !== undefined && !args.preferredRoomNumber.trim())
      throw new Error("Room number cannot be blank");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) throw new Error("User not found");

    const booking = await getLatestBookingForUser(ctx.db, user._id);
    if (!booking) throw new Error("No booking found");
    if (booking.status !== "accepted") throw new Error("Booking not accepted");

    const property = await ctx.db.get(booking.propertyId);
    if (!property) throw new Error("Property not found");

    return await ctx.db.insert("roomChangeRequests", {
      userId: user._id,
      propertyId: booking.propertyId,
      operatorId: property.operatorId,
      preferredRoomNumber: args.preferredRoomNumber,
      reason: args.reason,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const submitMoveOut = mutation({
  args: {
    moveOutDate: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.moveOutDate.trim()) throw new Error("Move-out date is required");
    if (!args.reason.trim()) throw new Error("Reason is required");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) throw new Error("User not found");

    const booking = await getLatestBookingForUser(ctx.db, user._id);
    if (!booking) throw new Error("No booking found");
    if (booking.status !== "accepted") throw new Error("Booking not accepted");

    const property = await ctx.db.get(booking.propertyId);
    if (!property) throw new Error("Property not found");

    return await ctx.db.insert("moveOutRequests", {
      userId: user._id,
      propertyId: booking.propertyId,
      operatorId: property.operatorId,
      moveOutDate: args.moveOutDate,
      reason: args.reason,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const submitExtendStay = mutation({
  args: {},
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) throw new Error("User not found");

    const booking = await getLatestBookingForUser(ctx.db, user._id);
    if (!booking) throw new Error("No booking found");
    if (booking.status !== "accepted") throw new Error("Booking not accepted");

    const property = await ctx.db.get(booking.propertyId);
    if (!property) throw new Error("Property not found");

    return await ctx.db.insert("extendStayRequests", {
      userId: user._id,
      propertyId: booking.propertyId,
      operatorId: property.operatorId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const getMyEditableProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return null;

    const booking = await ctx.db
      .query("bookingRequests")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .first();
    if (!booking || booking.status !== "accepted") return null;

    const tenants = await ctx.db
      .query("tenants")
      .withIndex("by_propertyId", (q: any) => q.eq("propertyId", booking.propertyId))
      .collect();
    const tenant = tenants.find((t: any) => t.studentPhone === booking.studentPhone);

    return {
      studentName: tenant?.studentName ?? booking.studentName ?? "",
      studentPhone: tenant?.studentPhone ?? booking.studentPhone ?? "",
      studentEmail: tenant?.studentEmail ?? "",
      course: tenant?.course ?? "",
      parentName: tenant?.parentName ?? "",
      parentPhone: tenant?.parentPhone ?? "",
      parentEmail: tenant?.parentEmail ?? "",
    };
  },
});

export const updateTenantProfile = mutation({
  args: {
    studentName: v.string(),
    studentPhone: v.string(),
    studentEmail: v.optional(v.string()),
    course: v.optional(v.string()),
    parentName: v.optional(v.string()),
    parentPhone: v.optional(v.string()),
    parentEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) throw new Error("User not found");

    // Update user table name and phone
    await ctx.db.patch(user._id, {
      name: args.studentName,
      phone: args.studentPhone,
    });

    // Find tenant record via accepted booking
    const booking = await ctx.db
      .query("bookingRequests")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .first();
    if (!booking || booking.status !== "accepted") return;

    const tenants = await ctx.db
      .query("tenants")
      .withIndex("by_propertyId", (q: any) => q.eq("propertyId", booking.propertyId))
      .collect();
    const tenant = tenants.find((t: any) => t.studentPhone === booking.studentPhone);
    if (!tenant) return;

    const patch: Record<string, unknown> = {
      studentName: args.studentName,
      studentPhone: args.studentPhone,
    };
    if (args.studentEmail !== undefined) patch.studentEmail = args.studentEmail;
    if (args.course !== undefined) patch.course = args.course;
    if (args.parentName !== undefined) patch.parentName = args.parentName;
    if (args.parentPhone !== undefined) patch.parentPhone = args.parentPhone;
    if (args.parentEmail !== undefined) patch.parentEmail = args.parentEmail;

    await ctx.db.patch(tenant._id, patch);
  },
});
