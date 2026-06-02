import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  return ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return ctx.db
      .query("tasks")
      .withIndex("by_operatorId", (q: any) => q.eq("operatorId", user._id))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    kind: v.string(),
    priority: v.union(v.literal("High"), v.literal("Med"), v.literal("Low")),
    status: v.union(v.literal("todo"), v.literal("doing"), v.literal("done")),
    bucket: v.union(v.literal("overdue"), v.literal("today"), v.literal("week"), v.literal("later")),
    due: v.optional(v.string()),
    propertyId: v.optional(v.id("properties")),
    linkedType: v.optional(v.string()),
    linkedLabel: v.optional(v.string()),
    linkedSub: v.optional(v.string()),
    assigneeName: v.optional(v.string()),
    assigneeRole: v.optional(v.string()),
    desc: v.optional(v.string()),
    subtasks: v.optional(v.array(v.object({ t: v.string(), done: v.boolean() }))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthenticated");
    return ctx.db.insert("tasks", { ...args, operatorId: user._id, createdAt: Date.now() });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(v.literal("todo"), v.literal("doing"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthenticated");
    const task = await ctx.db.get(args.id);
    if (!task || task.operatorId !== user._id) throw new Error("Not found");
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const updateSubtasks = mutation({
  args: {
    id: v.id("tasks"),
    subtasks: v.array(v.object({ t: v.string(), done: v.boolean() })),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthenticated");
    const task = await ctx.db.get(args.id);
    if (!task || task.operatorId !== user._id) throw new Error("Not found");
    await ctx.db.patch(args.id, { subtasks: args.subtasks });
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthenticated");
    const task = await ctx.db.get(args.id);
    if (!task || task.operatorId !== user._id) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});
