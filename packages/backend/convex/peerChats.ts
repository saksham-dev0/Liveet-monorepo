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

function formatRelativeTime(ms: number): string {
  const date = new Date(ms);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// ─── Get or create a peer conversation ───────────────────────────────────────

export const getOrCreate = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (me._id === args.otherUserId) throw new Error("Cannot chat with yourself.");

    // Canonical order: smaller id = userIdA for unique pair lookup
    const [userIdA, userIdB] =
      me._id < args.otherUserId
        ? [me._id, args.otherUserId]
        : [args.otherUserId, me._id];

    const existing = await ctx.db
      .query("peerConversations")
      .withIndex("by_pair", (q) => q.eq("userIdA", userIdA).eq("userIdB", userIdB))
      .unique();

    if (existing) return { conversationId: existing._id };

    const conversationId = await ctx.db.insert("peerConversations", {
      userIdA,
      userIdB,
    });
    return { conversationId };
  },
});

// ─── List peer messages ───────────────────────────────────────────────────────

export const listMessages = query({
  args: { conversationId: v.id("peerConversations") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);

    const conv = await ctx.db.get(args.conversationId);
    if (!conv) return [];
    if (conv.userIdA !== me._id && conv.userIdB !== me._id)
      throw new Error("Not a participant.");

    const msgs = await ctx.db
      .query("peerMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();

    return msgs.map((m) => ({
      _id: m._id as string,
      senderUserId: m.senderUserId as string,
      isMe: m.senderUserId === me._id,
      body: m.body,
      createdAt: m._creationTime,
    }));
  },
});

// ─── Send a peer message ──────────────────────────────────────────────────────

export const sendMessage = mutation({
  args: { conversationId: v.id("peerConversations"), body: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const body = args.body.trim();
    if (!body) throw new Error("Message cannot be empty.");

    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found.");
    if (conv.userIdA !== me._id && conv.userIdB !== me._id)
      throw new Error("Not a participant.");

    await ctx.db.insert("peerMessages", {
      conversationId: args.conversationId,
      senderUserId: me._id,
      body,
    });

    const isA = conv.userIdA === me._id;
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
      lastMessageText: body,
      unreadA: isA ? (conv.unreadA ?? 0) : (conv.unreadA ?? 0) + 1,
      unreadB: isA ? (conv.unreadB ?? 0) + 1 : (conv.unreadB ?? 0),
    });
  },
});

// ─── Mark conversation as read ────────────────────────────────────────────────

export const markRead = mutation({
  args: { conversationId: v.id("peerConversations") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) return;
    if (conv.userIdA !== me._id && conv.userIdB !== me._id) return;
    const isA = conv.userIdA === me._id;
    await ctx.db.patch(args.conversationId, {
      unreadA: isA ? 0 : conv.unreadA,
      unreadB: isA ? conv.unreadB : 0,
    });
  },
});

// ─── List my peer chats ───────────────────────────────────────────────────────

export const listMyChats = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);

    const asA = await ctx.db
      .query("peerConversations")
      .withIndex("by_userA", (q) => q.eq("userIdA", me._id))
      .collect();
    const asB = await ctx.db
      .query("peerConversations")
      .withIndex("by_userB", (q) => q.eq("userIdB", me._id))
      .collect();

    const all = [...asA, ...asB].sort(
      (a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0),
    );

    return await Promise.all(
      all.map(async (conv) => {
        const otherId = conv.userIdA === me._id ? conv.userIdB : conv.userIdA;
        const other = await ctx.db.get(otherId);
        const isA = conv.userIdA === me._id;
        const unread = isA ? (conv.unreadA ?? 0) : (conv.unreadB ?? 0);
        return {
          conversationId: conv._id as string,
          otherUserId: otherId as string,
          otherName: other?.name ?? "Unknown",
          otherImageUrl: other?.imageUrl ?? null,
          lastMessageAt: conv.lastMessageAt ?? null,
          lastMessageText: conv.lastMessageText ?? null,
          lastMessageTimeLabel: conv.lastMessageAt
            ? formatRelativeTime(conv.lastMessageAt)
            : null,
          unread,
        };
      }),
    );
  },
});
