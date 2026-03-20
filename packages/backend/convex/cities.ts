import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const ensureSeeded = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("cities").withIndex("by_name").take(1);
    if (existing.length > 0) return;

    const names = [
      "Mumbai",
      "Delhi",
      "Bengaluru",
      "Hyderabad",
      "Ahmedabad",
      "Chennai",
      "Kolkata",
      "Pune",
      "Jaipur",
      "Surat",
      "Lucknow",
      "Kanpur",
      "Nagpur",
      "Indore",
      "Thane",
      "Bhopal",
      "Visakhapatnam",
      "Patna",
      "Vadodara",
      "Ghaziabad",
    ];

    for (const name of names) {
      await ctx.db.insert("cities", {
        name,
        countryCode: "IN",
      });
    }
  },
});

export const searchCities = query({
  args: {
    searchTerm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const term = (args.searchTerm ?? "").trim().toLowerCase();

    const all = await ctx.db.query("cities").withIndex("by_name").take(200);
    if (!term) {
      return all.slice(0, 50);
    }

    const filtered = all.filter((city) =>
      city.name.toLowerCase().includes(term),
    );
    return filtered.slice(0, 50);
  },
});

export const getById = query({
  args: {
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    const city = await ctx.db.get(args.cityId as Id<"cities">);
    return city;
  },
});


