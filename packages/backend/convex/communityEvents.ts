import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

async function requireUser(ctx: MutationCtx | QueryCtx) {
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

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listCommunityEvents = query({
  args: { communityId: v.id("communities") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    let currentUserId: string | null = null;
    if (identity?.tokenIdentifier) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) =>
          q.eq("tokenIdentifier", identity.tokenIdentifier),
        )
        .unique();
      currentUserId = user?._id ?? null;
    }

    const events = await ctx.db
      .query("communityEvents")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .order("desc")
      .collect();

    return await Promise.all(
      events.map(async (e) => {
        const registrations = await ctx.db
          .query("communityEventRegistrations")
          .withIndex("by_event", (q) => q.eq("eventId", e._id))
          .collect();

        const soldCount = registrations.length;
        const isFull = e.totalTickets != null && soldCount >= e.totalTickets;
        const isRegistered = currentUserId
          ? registrations.some((r) => r.userId === currentUserId)
          : false;

        return {
          id: e._id,
          name: e.name,
          organizer: e.organizer,
          place: e.place,
          dateTime: e.dateTime,
          about: e.about ?? "",
          isFree: e.isFree,
          ticketPrice: e.ticketPrice ?? null,
          totalTickets: e.totalTickets ?? null,
          soldCount,
          isFull,
          isRegistered,
          createdAt: e._creationTime,
        };
      }),
    );
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const createCommunityEvent = mutation({
  args: {
    communityId: v.id("communities"),
    name: v.string(),
    organizer: v.string(),
    place: v.string(),
    dateTime: v.string(),
    about: v.optional(v.string()),
    isFree: v.boolean(),
    ticketPrice: v.optional(v.number()),
    totalTickets: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Must be an admin of the community
    const membership = await ctx.db
      .query("communityMembers")
      .withIndex("by_community_and_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", user._id),
      )
      .unique();
    if (!membership?.isAdmin)
      throw new Error("Only community admins can create events.");

    const name = args.name.trim();
    const organizer = args.organizer.trim();
    const place = args.place.trim();
    const dateTime = args.dateTime.trim();

    if (!name) throw new Error("Event name is required.");
    if (!organizer) throw new Error("Organizer name is required.");
    if (!place) throw new Error("Place is required.");
    if (!dateTime) throw new Error("Date & time is required.");
    if (!args.isFree && (args.ticketPrice == null || args.ticketPrice <= 0))
      throw new Error("Ticket price must be greater than 0 for paid events.");
    if (args.totalTickets != null && (!Number.isInteger(args.totalTickets) || args.totalTickets <= 0))
      throw new Error("Total tickets must be a positive whole number.");

    await ctx.db.insert("communityEvents", {
      communityId: args.communityId,
      createdByUserId: user._id,
      name,
      organizer,
      place,
      dateTime,
      about: args.about?.trim() || undefined,
      isFree: args.isFree,
      ticketPrice: args.isFree ? undefined : args.ticketPrice,
      totalTickets: args.totalTickets,
    });
  },
});

export const registerForEvent = mutation({
  args: { eventId: v.id("communityEvents") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("communityEventRegistrations")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id),
      )
      .unique();
    if (existing) return; // already registered

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found.");

    if (event.totalTickets != null) {
      const soldCount = (
        await ctx.db
          .query("communityEventRegistrations")
          .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
          .collect()
      ).length;
      if (soldCount >= event.totalTickets) throw new Error("This event is sold out.");
    }

    await ctx.db.insert("communityEventRegistrations", {
      eventId: args.eventId,
      userId: user._id,
    });
  },
});

export const unregisterFromEvent = mutation({
  args: { eventId: v.id("communityEvents") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const record = await ctx.db
      .query("communityEventRegistrations")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id),
      )
      .unique();
    if (record) await ctx.db.delete(record._id);
  },
});
