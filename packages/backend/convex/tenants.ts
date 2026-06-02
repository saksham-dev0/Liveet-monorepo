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
