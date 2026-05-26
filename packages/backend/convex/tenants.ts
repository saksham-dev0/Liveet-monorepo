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
    paymentStatus: v.union(
      v.literal("paid"),
      v.literal("partial"),
      v.literal("pending")
    ),
  },
  handler: async (ctx, args) => {
    const { user, property } = await resolveOperatorAndProperty(ctx);

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
      createdAt: Date.now(),
    });

    return tenantId;
  },
});
