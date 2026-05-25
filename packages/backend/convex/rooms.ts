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

// ─── Queries ────────────────────────────────────────────────

export const getFloorsWithRooms = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return null;

    const property = await ctx.db
      .query("properties")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", user._id))
      .first();
    if (!property) return null;

    const floors = await ctx.db
      .query("floors")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", property._id))
      .collect();

    floors.sort((a, b) => a.order - b.order);

    const floorsWithRooms = await Promise.all(
      floors.map(async (floor) => {
        const rooms = await ctx.db
          .query("rooms")
          .withIndex("by_floorId", (q) => q.eq("floorId", floor._id))
          .collect();
        return { ...floor, rooms };
      })
    );

    return { property, floors: floorsWithRooms };
  },
});

// ─── Mutations ──────────────────────────────────────────────

export const addFloor = mutation({
  args: {
    label: v.string(),
    short: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, property } = await resolveOperatorAndProperty(ctx);

    const existing = await ctx.db
      .query("floors")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", property._id))
      .collect();

    const order = existing.length;

    return await ctx.db.insert("floors", {
      propertyId: property._id,
      operatorId: user._id,
      label: args.label,
      short: args.short,
      order,
    });
  },
});

export const deleteFloor = mutation({
  args: { floorId: v.id("floors") },
  handler: async (ctx, args) => {
    const { user } = await resolveOperatorAndProperty(ctx);

    const floor = await ctx.db.get(args.floorId);
    if (!floor || floor.operatorId !== user._id) throw new Error("Not found");

    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_floorId", (q) => q.eq("floorId", args.floorId))
      .collect();

    await Promise.all(rooms.map((r) => ctx.db.delete(r._id)));
    await ctx.db.delete(args.floorId);
  },
});

export const addRoom = mutation({
  args: {
    floorId: v.id("floors"),
    roomNumber: v.string(),
    type: v.string(),
    capacity: v.number(),
    rent: v.optional(v.number()),
    deposit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, property } = await resolveOperatorAndProperty(ctx);

    const floor = await ctx.db.get(args.floorId);
    if (!floor || floor.operatorId !== user._id) throw new Error("Not found");

    return await ctx.db.insert("rooms", {
      propertyId: property._id,
      floorId: args.floorId,
      operatorId: user._id,
      roomNumber: args.roomNumber,
      type: args.type,
      capacity: args.capacity,
      rent: args.rent,
      deposit: args.deposit,
    });
  },
});

export const updateRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    roomNumber: v.optional(v.string()),
    type: v.optional(v.string()),
    capacity: v.optional(v.number()),
    rent: v.optional(v.number()),
    deposit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await resolveOperatorAndProperty(ctx);
    const { roomId, ...fields } = args;

    const room = await ctx.db.get(roomId);
    if (!room || room.operatorId !== user._id) throw new Error("Not found");

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) patch[k] = v;
    }
    await ctx.db.patch(roomId, patch);
  },
});

export const deleteRoom = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const { user } = await resolveOperatorAndProperty(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room || room.operatorId !== user._id) throw new Error("Not found");
    await ctx.db.delete(args.roomId);
  },
});
