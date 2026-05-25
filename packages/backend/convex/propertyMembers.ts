import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

async function getAuthUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();
  if (!user) throw new Error("User not found");
  return user;
}

async function getCallerRole(
  ctx: any,
  propertyId: Id<"properties">
): Promise<"owner" | "manager" | null> {
  const user = await getAuthUser(ctx);

  const member = await ctx.db
    .query("propertyMembers")
    .withIndex("by_propertyId_userId", (q: any) =>
      q.eq("propertyId", propertyId).eq("userId", user._id)
    )
    .unique();
  if (member) return member.role;

  // Fallback for users who onboarded before propertyMembers feature:
  // if they are the operatorId on the property, treat as owner and backfill the row.
  const property = await ctx.db.get(propertyId);
  if (property && property.operatorId === user._id) {
    await ctx.db.insert("propertyMembers", {
      propertyId,
      userId: user._id,
      role: "owner",
      joinedAt: Date.now(),
    });
    return "owner";
  }

  return null;
}

export const getMyRoleForProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    return await getCallerRole(ctx, args.propertyId);
  },
});

export const getMyProperties = query({
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

    const memberships = await ctx.db
      .query("propertyMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const properties = await Promise.all(
      memberships.map(async (m) => {
        const property = await ctx.db.get(m.propertyId);
        return property ? { ...property, myRole: m.role } : null;
      })
    );
    return properties.filter(Boolean);
  },
});

export const getTeam = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx, args.propertyId);
    if (!role) throw new Error("Not a member of this property");

    const members = await ctx.db
      .query("propertyMembers")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", args.propertyId))
      .collect();

    const membersWithUsers = await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          _id: m._id,
          role: m.role,
          joinedAt: m.joinedAt,
          user: user
            ? { _id: user._id, name: user.name, email: user.email, imageUrl: user.imageUrl }
            : null,
        };
      })
    );

    const pendingInvites = await ctx.db
      .query("propertyInvites")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", args.propertyId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    return { members: membersWithUsers, pendingInvites };
  },
});

export const inviteManager = mutation({
  args: {
    propertyId: v.id("properties"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const role = await getCallerRole(ctx, args.propertyId);
    if (role !== "owner") throw new Error("Only owners can invite managers");

    // Check no active invite for this email+property
    const existing = await ctx.db
      .query("propertyInvites")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", args.propertyId))
      .filter((q) =>
        q.and(q.eq(q.field("email"), args.email), q.eq(q.field("status"), "pending"))
      )
      .first();
    if (existing) throw new Error("Invite already sent to this email");

    // Check if user with this email is already a member
    const invitedUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();
    if (invitedUser) {
      const alreadyMember = await ctx.db
        .query("propertyMembers")
        .withIndex("by_propertyId_userId", (q) =>
          q.eq("propertyId", args.propertyId).eq("userId", invitedUser._id)
        )
        .unique();
      if (alreadyMember) throw new Error("User is already a team member");
    }

    const token =
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");

    const inviteId = await ctx.db.insert("propertyInvites", {
      propertyId: args.propertyId,
      email: args.email,
      token,
      status: "pending",
      invitedBy: user._id,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    await ctx.scheduler.runAfter(0, internal.emails.sendInviteEmail, {
      toEmail: args.email,
      propertyName: property.name,
      inviterName: user.name ?? "Your property manager",
      token,
    });

    return { inviteId, token };
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);

    const invite = await ctx.db
      .query("propertyInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invite) throw new Error("Invalid invite link");
    if (invite.status !== "pending") throw new Error("Invite already used or revoked");
    if (invite.expiresAt < Date.now()) throw new Error("Invite has expired");
    if (invite.email !== user.email) throw new Error("Invite is for a different email");

    // Check not already a member
    const existing = await ctx.db
      .query("propertyMembers")
      .withIndex("by_propertyId_userId", (q) =>
        q.eq("propertyId", invite.propertyId).eq("userId", user._id)
      )
      .unique();
    if (existing) throw new Error("Already a member of this property");

    await ctx.db.insert("propertyMembers", {
      propertyId: invite.propertyId,
      userId: user._id,
      role: "manager",
      invitedBy: invite.invitedBy,
      joinedAt: Date.now(),
    });

    await ctx.db.patch(invite._id, { status: "accepted" });

    return { propertyId: invite.propertyId };
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("propertyInvites") },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invite not found");

    const role = await getCallerRole(ctx, invite.propertyId);
    if (role !== "owner") throw new Error("Only owners can revoke invites");

    await ctx.db.patch(args.inviteId, { status: "revoked" });
  },
});

export const removeMember = mutation({
  args: {
    membershipId: v.id("propertyMembers"),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error("Member not found");

    const role = await getCallerRole(ctx, membership.propertyId);
    if (role !== "owner") throw new Error("Only owners can remove members");
    if (membership.role === "owner") throw new Error("Cannot remove the owner");

    await ctx.db.delete(args.membershipId);
  },
});
