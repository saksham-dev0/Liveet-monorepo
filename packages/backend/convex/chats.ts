import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function requireUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();
  if (!user) throw new Error("User not found");
  return user;
}

async function optionalUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();
}

function formatRelativeTime(ms: number): string {
  const date = new Date(ms);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// ─── Tenant: list chats ───────────────────────────────────────────────────────

/**
 * Returns all liked properties enriched with conversation info (if started).
 * Used as the tenant's chats list.
 */
export const listChatsForTenant = query({
  args: {},
  handler: async (ctx) => {
    const user = await optionalUser(ctx);
    if (!user) return [];

    const swipes = await ctx.db
      .query("tenantPropertySwipes")
      .withIndex("by_tenant", (q: any) => q.eq("tenantUserId", user._id))
      .filter((q: any) => q.eq(q.field("liked"), true))
      .collect();

    if (swipes.length === 0) return [];

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_tenant", (q: any) => q.eq("tenantUserId", user._id))
      .collect();

    const convByPropertyId = new Map<string, any>(
      conversations.map((c: any) => [c.propertyId as string, c])
    );

    const results = await Promise.all(
      swipes.map(async (swipe: any) => {
        const property = (await ctx.db.get(swipe.propertyId)) as any;
        if (!property) return null;

        const coverImageUrl = property.coverImageFileId
          ? await ctx.storage.getUrl(property.coverImageFileId)
          : null;

        const conv = convByPropertyId.get(swipe.propertyId as string);

        return {
          propertyId: swipe.propertyId as string,
          propertyName: property.name ?? "Unnamed property",
          propertyCity: property.city ?? null,
          coverImageUrl: coverImageUrl ?? null,
          conversationId: conv ? (conv._id as string) : null,
          lastMessageAt: conv?.lastMessageAt ?? null,
          lastMessageText: conv?.lastMessageText ?? null,
          lastMessageTimeLabel: conv?.lastMessageAt
            ? formatRelativeTime(conv.lastMessageAt)
            : null,
          unreadCount: (conv?.tenantUnreadCount ?? 0) as number,
        };
      })
    );

    // Only return properties that have an actual conversation started
    const filtered = results.filter(
      (r): r is NonNullable<typeof r> => r !== null && r.conversationId !== null
    );

    return filtered.sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt - a.lastMessageAt;
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return 0;
    });
  },
});

// ─── Tenant: messages ─────────────────────────────────────────────────────────

/**
 * Real-time messages for a tenant's conversation about a specific property.
 */
export const listMessagesByProperty = query({
  args: { propertyId: v.id("properties"), afterTime: v.optional(v.number()) },
  handler: async (ctx, { propertyId, afterTime }) => {
    const user = await optionalUser(ctx);
    if (!user) return [];

    const conv = await ctx.db
      .query("conversations")
      .withIndex("by_property_and_tenant", (q: any) =>
        q.eq("propertyId", propertyId).eq("tenantUserId", user._id)
      )
      .unique();

    if (!conv) return [];

    let q = ctx.db
      .query("messages")
      .withIndex("by_conversation", (q: any) => q.eq("conversationId", conv._id));

    if (afterTime !== undefined) {
      q = q.filter((q: any) => q.gt(q.field("_creationTime"), afterTime));
    }

    const msgs = await q.order("asc").collect();

    return msgs.map((m: any) => ({
      _id: m._id as string,
      senderRole: m.senderRole as "tenant" | "operator",
      body: m.body as string,
      createdAt: m._creationTime as number,
    }));
  },
});

// ─── Tenant: send message ────────────────────────────────────────────────────

/**
 * Send a message from the tenant about a property.
 * Creates the conversation automatically on first message.
 */
export const sendMessageByProperty = mutation({
  args: {
    propertyId: v.id("properties"),
    body: v.string(),
  },
  handler: async (ctx, { propertyId, body }) => {
    const user = await requireUser(ctx);

    const trimmed = body.trim();
    if (!trimmed) throw new Error("Message cannot be empty");
    if (trimmed.length > 2000) throw new Error("Message cannot exceed 2000 characters");

    const property = await ctx.db.get(propertyId);
    if (!property) throw new Error("Property not found");

    let conv = await ctx.db
      .query("conversations")
      .withIndex("by_property_and_tenant", (q: any) =>
        q.eq("propertyId", propertyId).eq("tenantUserId", user._id)
      )
      .unique();

    if (!conv) {
      const convId = await ctx.db.insert("conversations", {
        propertyId,
        tenantUserId: user._id,
        operatorUserId: property.userId,
        tenantUnreadCount: 0,
        operatorUnreadCount: 0,
      });
      await ctx.db.insert("messages", {
        conversationId: convId,
        senderUserId: user._id,
        senderRole: "tenant",
        body: trimmed,
      });
      await ctx.db.patch(convId, {
        lastMessageAt: Date.now(),
        lastMessageText: trimmed.slice(0, 100),
        operatorUnreadCount: 1,
      });
    } else {
      await ctx.db.insert("messages", {
        conversationId: conv._id,
        senderUserId: user._id,
        senderRole: "tenant",
        body: trimmed,
      });
      await ctx.db.patch(conv._id, {
        lastMessageAt: Date.now(),
        lastMessageText: trimmed.slice(0, 100),
        operatorUnreadCount: (conv.operatorUnreadCount ?? 0) + 1,
      });
    }
  },
});

// ─── Tenant: mark read ────────────────────────────────────────────────────────

export const markReadByProperty = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    const user = await optionalUser(ctx);
    if (!user) return;

    const conv = await ctx.db
      .query("conversations")
      .withIndex("by_property_and_tenant", (q: any) =>
        q.eq("propertyId", propertyId).eq("tenantUserId", user._id)
      )
      .unique();
    if (!conv) return;

    await ctx.db.patch(conv._id, { tenantUnreadCount: 0 });
  },
});

// ─── Operator: list conversations ────────────────────────────────────────────

/**
 * All conversations for the operator, sorted by most recent message.
 */
export const listConversationsForOperator = query({
  args: {},
  handler: async (ctx) => {
    const user = await optionalUser(ctx);
    if (!user) return [];

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_operator", (q: any) => q.eq("operatorUserId", user._id))
      .collect();

    if (conversations.length === 0) return [];

    const results = await Promise.all(
      conversations.map(async (conv: any) => {
        const property = (await ctx.db.get(conv.propertyId)) as any;
        const tenant = (await ctx.db.get(conv.tenantUserId)) as any;

        return {
          _id: conv._id as string,
          propertyId: conv.propertyId as string,
          propertyName: property?.name ?? "Unnamed property",
          tenantName: tenant?.name ?? "Tenant",
          tenantImageUrl: tenant?.imageUrl ?? null,
          lastMessageAt: conv.lastMessageAt ?? null,
          lastMessageText: conv.lastMessageText ?? null,
          lastMessageTimeLabel: conv.lastMessageAt
            ? formatRelativeTime(conv.lastMessageAt)
            : null,
          unreadCount: (conv.operatorUnreadCount ?? 0) as number,
        };
      })
    );

    return results.sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt - a.lastMessageAt;
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return 0;
    });
  },
});

// ─── Operator: messages ───────────────────────────────────────────────────────

/**
 * Real-time messages for an operator in a specific conversation.
 */
export const listMessagesForConversation = query({
  args: { conversationId: v.id("conversations"), afterTime: v.optional(v.number()) },
  handler: async (ctx, { conversationId, afterTime }) => {
    const user = await optionalUser(ctx);
    if (!user) return [];

    const conv = await ctx.db.get(conversationId);
    if (!conv || (conv as any).operatorUserId !== user._id) return [];

    let q = ctx.db
      .query("messages")
      .withIndex("by_conversation", (q: any) => q.eq("conversationId", conversationId));

    if (afterTime !== undefined) {
      q = q.filter((q: any) => q.gt(q.field("_creationTime"), afterTime));
    }

    const msgs = await q.order("asc").collect();

    return msgs.map((m: any) => ({
      _id: m._id as string,
      senderRole: m.senderRole as "tenant" | "operator",
      body: m.body as string,
      createdAt: m._creationTime as number,
    }));
  },
});

// ─── Operator: send message ───────────────────────────────────────────────────

/**
 * Send a message from the operator in a specific conversation.
 */
export const sendMessageByConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
  },
  handler: async (ctx, { conversationId, body }) => {
    const user = await requireUser(ctx);

    const trimmed = body.trim();
    if (!trimmed) throw new Error("Message cannot be empty");
    if (trimmed.length > 2000) throw new Error("Message cannot exceed 2000 characters");

    const conv = await ctx.db.get(conversationId);
    if (!conv) throw new Error("Conversation not found");
    if ((conv as any).operatorUserId !== user._id) throw new Error("Not authorized");

    await ctx.db.insert("messages", {
      conversationId,
      senderUserId: user._id,
      senderRole: "operator",
      body: trimmed,
    });

    await ctx.db.patch(conversationId, {
      lastMessageAt: Date.now(),
      lastMessageText: trimmed.slice(0, 100),
      tenantUnreadCount: ((conv as any).tenantUnreadCount ?? 0) + 1,
    });
  },
});

// ─── Operator: mark read ─────────────────────────────────────────────────────

export const markReadByConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const user = await optionalUser(ctx);
    if (!user) return;
    const conv = await ctx.db.get(conversationId);
    if (!conv || (conv as any).operatorUserId !== user._id) return;
    await ctx.db.patch(conversationId, { operatorUnreadCount: 0 });
  },
});

export const getOrCreateConversationForApplication = mutation({
  args: { applicationId: v.id("tenantMoveInApplications") },
  handler: async (ctx, { applicationId }) => {
    const operator = await requireUser(ctx);

    const app = await ctx.db.get(applicationId);
    if (!app) throw new Error("Application not found");

    const property = await ctx.db.get(app.propertyId);
    if (!property || property.userId !== operator._id) {
      throw new Error("You do not have access to this application");
    }

    let conv = await ctx.db
      .query("conversations")
      .withIndex("by_property_and_tenant", (q: any) =>
        q.eq("propertyId", app.propertyId).eq("tenantUserId", app.tenantUserId)
      )
      .unique();

    if (!conv) {
      const convId = await ctx.db.insert("conversations", {
        propertyId: app.propertyId,
        tenantUserId: app.tenantUserId,
        operatorUserId: operator._id,
        tenantUnreadCount: 0,
        operatorUnreadCount: 0,
      });
      return { conversationId: convId };
    }

    return { conversationId: conv._id };
  },
});
