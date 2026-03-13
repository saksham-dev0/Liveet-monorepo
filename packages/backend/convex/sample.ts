import { query } from "./_generated/server";
import { v } from "convex/values";

export const hello = query({
  args: {
    name: v.string(),
  },
  handler: async (_ctx, args) => {
    return `Hello, ${args.name}! This is a Convex response.`;
  },
});

