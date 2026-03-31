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

// ─── Communities ────────────────────────────────────────────────────────────

export const createCommunity = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Community name is required.");

    const communityId = await ctx.db.insert("communities", {
      name,
      description: args.description?.trim(),
      category: args.category,
      createdByUserId: user._id,
      isPublic: args.isPublic ?? true,
    });

    // Auto-join creator
    await ctx.db.insert("communityMembers", {
      communityId,
      userId: user._id,
    });

    return { communityId };
  },
});

export const joinCommunity = mutation({
  args: { communityId: v.id("communities") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("communityMembers")
      .withIndex("by_community_and_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", user._id),
      )
      .unique();
    if (existing) return; // already a member
    await ctx.db.insert("communityMembers", {
      communityId: args.communityId,
      userId: user._id,
    });
  },
});

export const leaveCommunity = mutation({
  args: { communityId: v.id("communities") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const membership = await ctx.db
      .query("communityMembers")
      .withIndex("by_community_and_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", user._id),
      )
      .unique();
    if (membership) await ctx.db.delete(membership._id);
  },
});

export const listCommunities = query({
  args: {},
  handler: async (ctx) => {
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

    const communities = await ctx.db
      .query("communities")
      .order("desc")
      .take(50);

    return await Promise.all(
      communities.map(async (c) => {
        const members = await ctx.db
          .query("communityMembers")
          .withIndex("by_community", (q) => q.eq("communityId", c._id))
          .take(500);
        const isMember = currentUserId
          ? members.some((m) => m.userId === currentUserId)
          : false;
        const creator = await ctx.db.get(c.createdByUserId);
        return {
          id: c._id,
          name: c.name,
          description: c.description ?? "",
          category: c.category,
          isPublic: c.isPublic ?? true,
          memberCount: members.length,
          isMember,
          creatorName: creator?.name ?? "Unknown",
          createdAt: c._creationTime,
        };
      }),
    );
  },
});

// ─── Hangouts ────────────────────────────────────────────────────────────────

export const createHangout = mutation({
  args: {
    communityId: v.optional(v.id("communities")),
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    dateTime: v.string(),
    maxAttendees: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const title = args.title.trim();
    if (!title) throw new Error("Hangout title is required.");
    if (!args.dateTime.trim()) throw new Error("Date & time is required.");

    const hangoutId = await ctx.db.insert("hangouts", {
      communityId: args.communityId,
      createdByUserId: user._id,
      title,
      description: args.description?.trim(),
      location: args.location?.trim(),
      dateTime: args.dateTime.trim(),
      maxAttendees: args.maxAttendees,
      status: "open",
    });

    // Creator auto-joins
    await ctx.db.insert("hangoutAttendees", {
      hangoutId,
      userId: user._id,
      status: "accepted",
    });

    return { hangoutId };
  },
});

export const requestJoinHangout = mutation({
  args: { hangoutId: v.id("hangouts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("hangoutAttendees")
      .withIndex("by_hangout_and_user", (q) =>
        q.eq("hangoutId", args.hangoutId).eq("userId", user._id),
      )
      .unique();
    if (existing) return; // already requested or attending

    const hangout = await ctx.db.get(args.hangoutId);
    if (!hangout || hangout.status !== "open")
      throw new Error("Hangout is not open.");

    await ctx.db.insert("hangoutAttendees", {
      hangoutId: args.hangoutId,
      userId: user._id,
      status: "accepted", // open hangouts: auto-accept
    });
  },
});

export const leaveHangout = mutation({
  args: { hangoutId: v.id("hangouts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const record = await ctx.db
      .query("hangoutAttendees")
      .withIndex("by_hangout_and_user", (q) =>
        q.eq("hangoutId", args.hangoutId).eq("userId", user._id),
      )
      .unique();
    if (record) await ctx.db.delete(record._id);
  },
});

export const listHangouts = query({
  args: {},
  handler: async (ctx) => {
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

    const hangouts = await ctx.db.query("hangouts").order("desc").take(50);

    return await Promise.all(
      hangouts.map(async (h) => {
        const attendees = await ctx.db
          .query("hangoutAttendees")
          .withIndex("by_hangout", (q) => q.eq("hangoutId", h._id))
          .take(500);
        const isGoing = currentUserId
          ? attendees.some((a) => a.userId === currentUserId)
          : false;
        const creator = await ctx.db.get(h.createdByUserId);
        const community = h.communityId
          ? await ctx.db.get(h.communityId)
          : null;
        return {
          id: h._id,
          title: h.title,
          description: h.description ?? "",
          location: h.location ?? "",
          dateTime: h.dateTime,
          maxAttendees: h.maxAttendees ?? null,
          attendeeCount: attendees.length,
          status: h.status ?? "open",
          isGoing,
          creatorName: creator?.name ?? "Unknown",
          communityName: community?.name ?? null,
          createdAt: h._creationTime,
        };
      }),
    );
  },
});
