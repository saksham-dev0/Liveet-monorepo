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

// ─── Residency Check ────────────────────────────────────────────────────────

/** Returns the current tenant's active residency (approved + assigned room), or null. */
export const getMyResidency = query({
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

    const applications = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_tenant", (q) => q.eq("tenantUserId", user._id))
      .collect();
    const active = applications.find(
      (r) => r.assignedRoomId != null || r.status === "submitted",
    );
    if (!active) return null;

    const property = await ctx.db.get(active.propertyId);
    return {
      propertyId: active.propertyId,
      propertyName: property?.name ?? "",
    };
  },
});

// ─── Single Community ────────────────────────────────────────────────────────

export const getCommunity = query({
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

    const c = await ctx.db.get(args.communityId);
    if (!c) return null;

    const members = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", c._id))
      .collect();

    const myMembership = currentUserId
      ? members.find((m) => m.userId === currentUserId) ?? null
      : null;
    const isMember = myMembership !== null;
    const isAdmin = myMembership?.isAdmin === true;
    const adminCount = members.filter((m) => m.isAdmin).length;
    const isSoleAdmin = isAdmin && adminCount === 1;

    const creator = await ctx.db.get(c.createdByUserId);

    // Collect up to 5 member names for avatar initials
    const memberUsers = await Promise.all(
      members.slice(0, 5).map((m) => ctx.db.get(m.userId)),
    );

    const bannerImageUrl = c.bannerImageFileId
      ? await ctx.storage.getUrl(c.bannerImageFileId)
      : null;

    return {
      id: c._id,
      name: c.name,
      description: c.description ?? "",
      category: c.category,
      isPublic: c.isPublic ?? true,
      propertyName: c.propertyName ?? "",
      memberCount: members.length,
      isMember,
      isAdmin,
      isSoleAdmin,
      isCreator: currentUserId === c.createdByUserId,
      creatorName: creator?.name ?? "Unknown",
      createdAt: c._creationTime,
      memberNames: memberUsers
        .filter(Boolean)
        .map((u) => u!.name ?? "?"),
      bannerImageUrl: bannerImageUrl ?? null,
      bannerColor: c.bannerColor ?? null,
    };
  },
});

// ─── Community Settings ──────────────────────────────────────────────────────

export const generateCommunityBannerUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const updateCommunity = mutation({
  args: {
    communityId: v.id("communities"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    bannerColor: v.optional(v.string()),
    bannerImageFileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const community = await ctx.db.get(args.communityId);
    if (!community) throw new Error("Community not found.");
    const membership = await ctx.db
      .query("communityMembers")
      .withIndex("by_community_and_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", user._id),
      )
      .unique();
    if (!membership?.isAdmin)
      throw new Error("Only admins can edit this community.");

    const patch: Record<string, any> = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Name cannot be empty.");
      patch.name = name;
    }
    if (args.description !== undefined) patch.description = args.description.trim() || undefined;
    if (args.category !== undefined) patch.category = args.category;
    if (args.isPublic !== undefined) patch.isPublic = args.isPublic;
    if (args.bannerColor !== undefined) patch.bannerColor = args.bannerColor || undefined;
    if (args.bannerImageFileId !== undefined) patch.bannerImageFileId = args.bannerImageFileId;

    await ctx.db.patch(args.communityId, patch);
  },
});

// ─── Member Management ───────────────────────────────────────────────────────

export const listCommunityMembers = query({
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

    const community = await ctx.db.get(args.communityId);
    if (!community) return [];

    const members = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .collect();

    return await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          userId: m.userId,
          name: user?.name ?? "Unknown",
          isAdmin: m.isAdmin === true,
          isCreator: m.userId === community.createdByUserId,
          isMe: m.userId === currentUserId,
        };
      }),
    );
  },
});

export const makeAdmin = mutation({
  args: {
    communityId: v.id("communities"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    // Caller must be an admin
    const callerMembership = await ctx.db
      .query("communityMembers")
      .withIndex("by_community_and_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", user._id),
      )
      .unique();
    if (!callerMembership?.isAdmin) throw new Error("Only admins can promote members.");

    const targetMembership = await ctx.db
      .query("communityMembers")
      .withIndex("by_community_and_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", args.targetUserId),
      )
      .unique();
    if (!targetMembership) throw new Error("User is not a member.");
    await ctx.db.patch(targetMembership._id, { isAdmin: true });
  },
});

export const removeAdmin = mutation({
  args: {
    communityId: v.id("communities"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const community = await ctx.db.get(args.communityId);
    if (!community) throw new Error("Community not found.");

    // Caller must be an admin
    const callerMembership = await ctx.db
      .query("communityMembers")
      .withIndex("by_community_and_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", user._id),
      )
      .unique();
    if (!callerMembership?.isAdmin) throw new Error("Only admins can change roles.");

    // Cannot demote the original creator
    if (args.targetUserId === community.createdByUserId)
      throw new Error("The original creator cannot be demoted.");

    const targetMembership = await ctx.db
      .query("communityMembers")
      .withIndex("by_community_and_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", args.targetUserId),
      )
      .unique();
    if (!targetMembership) throw new Error("User is not a member.");
    await ctx.db.patch(targetMembership._id, { isAdmin: false });
  },
});

export const deleteCommunity = mutation({
  args: { communityId: v.id("communities") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const community = await ctx.db.get(args.communityId);
    if (!community) throw new Error("Community not found.");
    if (community.createdByUserId !== user._id)
      throw new Error("Only the original creator can delete this community.");

    // Delete all memberships first
    const members = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .collect();
    await Promise.all(members.map((m) => ctx.db.delete(m._id)));
    await ctx.db.delete(args.communityId);
  },
});

// ─── Communities ────────────────────────────────────────────────────────────

export const createCommunity = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    isPublic: v.optional(v.boolean()),
    propertyName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Community name is required.");

    // Only tenants currently residing in a property can create communities
    const residency = await ctx.db
      .query("tenantMoveInApplications")
      .withIndex("by_tenant", (q) => q.eq("tenantUserId", user._id))
      .collect();
    const activeResidency = residency.find(
      (r) => r.assignedRoomId != null || r.status === "submitted",
    );
    if (!activeResidency) {
      throw new Error(
        "Only tenants currently residing in a property can create communities.",
      );
    }

    const communityId = await ctx.db.insert("communities", {
      name,
      description: args.description?.trim(),
      category: args.category,
      createdByUserId: user._id,
      isPublic: args.isPublic ?? true,
      propertyName: args.propertyName?.trim(),
    });

    // Auto-join creator as admin
    await ctx.db.insert("communityMembers", {
      communityId,
      userId: user._id,
      isAdmin: true,
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
          .collect();
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
          propertyName: c.propertyName ?? "",
          createdAt: c._creationTime,
        };
      }),
    );
  },
});

// ─── Hangouts ────────────────────────────────────────────────────────────────

export const getHangout = query({
  args: { hangoutId: v.id("hangouts") },
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

    const h = await ctx.db.get(args.hangoutId);
    if (!h) return null;

    const attendeeRecords = await ctx.db
      .query("hangoutAttendees")
      .withIndex("by_hangout", (q) => q.eq("hangoutId", args.hangoutId))
      .collect();

    const creator = await ctx.db.get(h.createdByUserId);
    const community = h.communityId ? await ctx.db.get(h.communityId) : null;

    const attendees = await Promise.all(
      attendeeRecords
        .filter((a) => a.userId !== h.createdByUserId)
        .map(async (a) => {
          const user = await ctx.db.get(a.userId);
          return {
            userId: a.userId as string,
            name: user?.name ?? "Unknown",
            imageUrl: user?.imageUrl ?? null,
          };
        }),
    );

    const isGoing = currentUserId
      ? attendeeRecords.some((a) => a.userId === currentUserId)
      : false;
    const isCreator = currentUserId === h.createdByUserId;
    const attendeeCount = attendeeRecords.filter(
      (a) => a.userId !== h.createdByUserId,
    ).length;
    const spotsLeft =
      h.maxAttendees != null ? h.maxAttendees - attendeeCount : null;

    return {
      id: h._id as string,
      title: h.title,
      description: h.description ?? "",
      location: h.location ?? "",
      dateTime: h.dateTime,
      maxAttendees: h.maxAttendees ?? null,
      attendeeCount,
      spotsLeft,
      status: h.status ?? "open",
      isGoing,
      isCreator,
      creatorUserId: h.createdByUserId as string,
      creatorName: creator?.name ?? "Unknown",
      creatorImageUrl: creator?.imageUrl ?? null,
      communityName: community?.name ?? null,
      attendees,
      createdAt: h._creationTime,
    };
  },
});

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
    if (
      args.maxAttendees !== undefined &&
      (!Number.isInteger(args.maxAttendees) || args.maxAttendees <= 0)
    )
      throw new Error("Max attendees must be a positive whole number.");

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

    if (hangout.maxAttendees != null) {
      const acceptedCount = (
        await ctx.db
          .query("hangoutAttendees")
          .withIndex("by_hangout", (q) => q.eq("hangoutId", args.hangoutId))
          .collect()
      ).filter((a) => a.status === "accepted" && a.userId !== hangout.createdByUserId).length;
      if (acceptedCount >= hangout.maxAttendees)
        throw new Error("Hangout is full.");
    }

    await ctx.db.insert("hangoutAttendees", {
      hangoutId: args.hangoutId,
      userId: user._id,
      status: "accepted", // open hangouts: auto-accept
    });

    // Notify the creator that someone joined
    await ctx.db.insert("notifications", {
      tenantUserId: hangout.createdByUserId,
      type: "hangout_join",
      title: "Someone joined your hangout!",
      body: `${user.name ?? "A user"} joined "${hangout.title}".`,
      read: false,
      refId: args.hangoutId,
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
          .collect();
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
          attendeeCount: attendees.filter((a) => a.userId !== h.createdByUserId).length,
          status: h.status ?? "open",
          isGoing,
          creatorName: creator?.name ?? "Unknown",
          creatorUserId: h.createdByUserId,
          communityName: community?.name ?? null,
          createdAt: h._creationTime,
        };
      }),
    );
  },
});
