import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

type RoomOption = {
  _id: string;
  category: string;
  typeName: string;
  rentAmount: number;
  attachedWashroom: boolean;
  attachedBalcony: boolean;
  airConditioner: boolean;
  geyser: boolean;
  customFeatures: string[];
};

async function getStorageUrl(ctx: QueryCtx, storageId: string | undefined) {
  if (!storageId) return null;
  return await ctx.storage.getUrl(storageId as Id<"_storage">);
}

function buildRoomOptions(property: Doc<"properties">) {
  const roomOptions: RoomOption[] = (property.roomPricings ?? []).map((rp, i) => ({
    _id: `${property._id}_room_${i}`,
    category: rp.roomType,
    typeName: rp.roomType,
    rentAmount: parseFloat(rp.rent) || 0,
    attachedWashroom: false,
    attachedBalcony: false,
    airConditioner: false,
    geyser: false,
    customFeatures: [],
  }));

  if (roomOptions.length === 0 && property.roomTypes && property.roomTypes.length > 0) {
    property.roomTypes.forEach((rt, i) => {
      roomOptions.push({
        _id: `${property._id}_room_${i}`,
        category: rt,
        typeName: rt,
        rentAmount: 0,
        attachedWashroom: false,
        attachedBalcony: false,
        airConditioner: false,
        geyser: false,
        customFeatures: [],
      });
    });
  }

  if (property.amenities && property.amenities.length > 0 && roomOptions.length > 0) {
    roomOptions[0].customFeatures = property.amenities;
  }

  return roomOptions;
}

function getTenantDetails(property: Doc<"properties">) {
  const gender = property.tenantGender?.toLowerCase() ?? "any";
  const occupation = property.tenantOccupation?.toLowerCase() ?? "";

  return {
    canStayMale: gender === "male" || gender === "any" || gender === "",
    canStayFemale: gender === "female" || gender === "any" || gender === "",
    canStayOthers: gender === "any" || gender === "",
    bestForStudent:
      occupation === "student" || occupation === "any" || occupation === "both",
    bestForWorkingProfessional:
      occupation === "professional" ||
      occupation === "working professional" ||
      occupation === "any" ||
      occupation === "both",
  };
}

export const listForTenants = query({
  args: {},
  handler: async (ctx) => {
    const properties = await ctx.db.query("properties").collect();

    return await Promise.all(
      properties.map(async (p) => {
        const coverImageUrl = await getStorageUrl(ctx, p.images?.[0]);
        const roomOptions = buildRoomOptions(p);

        return {
          _id: p._id,
          name: p.name,
          coverImageUrl,
          pincode: p.pincode ?? null,
          city: p.city ?? null,
          state: p.state ?? null,
          line1: p.addressLine1 ?? null,
          description: p.description ?? null,
          propertyType: p.propertyType,
          roomOptions,
          tenantDetails: getTenantDetails(p),
          agreement: {
            agreementDuration: p.agreementDuration ?? null,
            noticePeriod: p.noticePeriod ?? null,
            securityDepositDuration: null,
            lockInPeriod: null,
          },
          rent: null as null,
        };
      })
    );
  },
});

export const recordSwipe = mutation({
  args: {
    propertyId: v.id("properties"),
    liked: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    let user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      // User record missing — create it on-demand so swipes are never lost
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: identity.tokenIdentifier,
        clerkUserId: identity.subject,
        email: identity.email,
        name: identity.name,
        imageUrl: identity.pictureUrl,
        role: "tenant",
        hasCompletedOnboarding: false,
      });
      user = await ctx.db.get(userId);
    }

    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("propertyLikes")
      .withIndex("by_userId_propertyId", (q) =>
        q.eq("userId", user._id).eq("propertyId", args.propertyId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { liked: args.liked });
    } else {
      await ctx.db.insert("propertyLikes", {
        userId: user._id,
        propertyId: args.propertyId,
        liked: args.liked,
      });
    }
    return null;
  },
});

export const getLikedProperties = query({
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

    const likes = await ctx.db
      .query("propertyLikes")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("liked"), true))
      .collect();

    const results = await Promise.all(
      likes.map(async (like) => {
        const p = await ctx.db.get(like.propertyId);
        if (!p) return null;

        const coverImageUrl = await getStorageUrl(ctx, p.images?.[0]);

        const rentAmounts = (p.roomPricings ?? [])
          .map((rp) => parseFloat(rp.rent) || 0)
          .filter((a: number) => a > 0);
        const minRent = rentAmounts.length ? Math.min(...rentAmounts) : null;
        const maxRent = rentAmounts.length ? Math.max(...rentAmounts) : null;

        return {
          _id: p._id,
          name: p.name,
          coverImageUrl,
          city: p.city ?? null,
          state: p.state ?? null,
          minRent,
          maxRent,
          propertyType: p.propertyType ?? null,
        };
      })
    );

    return results.filter(Boolean);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getPaymentDetails = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const details = await ctx.db
      .query("paymentDetails")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", args.propertyId))
      .first();
    if (!details) return null;

    const qrImageUrl = await getStorageUrl(ctx, details.qrImageId);

    return {
      accountName: details.accountName ?? null,
      accountNumber: details.accountNumber ?? null,
      ifscCode: details.ifscCode ?? null,
      upiId: details.upiId ?? null,
      qrImageUrl,
    };
  },
});

export const submitBookingRequest = mutation({
  args: {
    propertyId: v.id("properties"),
    studentName: v.string(),
    studentPhone: v.string(),
    studentEmail: v.optional(v.string()),
    course: v.optional(v.string()),
    yearOfStudy: v.optional(v.string()),
    parentName: v.optional(v.string()),
    parentPhone: v.optional(v.string()),
    parentEmail: v.optional(v.string()),
    moveInDate: v.string(),
    foodPreference: v.optional(v.string()),
    roomTypePreference: v.optional(v.string()),
    paymentProofId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) throw new Error("User not found");

    await ctx.db.insert("bookingRequests", {
      propertyId: args.propertyId,
      userId: user._id,
      studentName: args.studentName,
      studentPhone: args.studentPhone,
      studentEmail: args.studentEmail,
      course: args.course,
      yearOfStudy: args.yearOfStudy,
      parentName: args.parentName,
      parentPhone: args.parentPhone,
      parentEmail: args.parentEmail,
      moveInDate: args.moveInDate,
      foodPreference: args.foodPreference,
      roomTypePreference: args.roomTypePreference,
      paymentProofId: args.paymentProofId,
      status: "pending",
      createdAt: Date.now(),
    });

    const property = await ctx.db.get(args.propertyId);
    if (property) {
      await ctx.db.insert("tasks", {
        operatorId: property.operatorId,
        title: `Booking request from ${args.studentName}`,
        kind: "booking",
        priority: "High",
        status: "todo",
        bucket: "today",
        due: args.moveInDate,
        propertyId: args.propertyId,
        linkedType: "booking",
        linkedLabel: args.studentName,
        linkedSub: args.roomTypePreference ?? undefined,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const getMyBookingRequest = query({
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

    const booking = await ctx.db
      .query("bookingRequests")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();
    if (!booking) return null;

    const p = await ctx.db.get(booking.propertyId);
    if (!p) return { ...booking, propertyName: null, propertyCity: null, propertyState: null, coverImageUrl: null };

    const coverImageUrl = await getStorageUrl(ctx, p.images?.[0]);

    // If accepted, find the tenant record by matching studentPhone at this property
    let tenantRent: number | null = null;
    let tenantPaymentStatus: string | null = null;
    let tenantPaymentHistory: any[] | null = null;
    let tenantId: string | null = null;
    let tenantBalanceDue: number | null = null;
    let tenantTotalCharges: number | null = null;
    let tenantCollected: number | null = null;
    if (booking.status === "accepted") {
      const tenants = await ctx.db
        .query("tenants")
        .withIndex("by_propertyId", (q) => q.eq("propertyId", booking.propertyId))
        .collect();
      const matched = tenants.find((t) => t.studentPhone === booking.studentPhone);
      if (matched) {
        tenantRent = matched.rent ?? null;
        tenantPaymentStatus = matched.paymentStatus ?? null;
        tenantPaymentHistory = matched.paymentHistory ?? null;
        tenantId = matched._id;
        // Compute balance the same way the operator's manage screen does
        const totalCharges =
          (matched.rent ?? 0) +
          (matched.advance ?? 0) +
          (matched.security ?? 0) +
          (matched.booking ?? 0) +
          (matched.maintenance ?? 0) +
          (matched.customCharges ?? []).reduce((s: number, c: any) => s + c.amount, 0);
        const collected = (matched.paymentHistory ?? []).reduce((s: number, e: any) => s + e.amount, 0);
        tenantTotalCharges = totalCharges;
        tenantCollected = collected;
        tenantBalanceDue = Math.max(0, totalCharges - collected);
      }
    }

    return {
      _id: booking._id,
      propertyId: booking.propertyId,
      studentName: booking.studentName,
      studentPhone: booking.studentPhone,
      moveInDate: booking.moveInDate,
      status: booking.status,
      createdAt: booking.createdAt,
      propertyName: p.name,
      propertyCity: p.city ?? null,
      propertyState: p.state ?? null,
      coverImageUrl,
      tenantRent,
      tenantPaymentStatus,
      tenantPaymentHistory,
      tenantId,
      tenantBalanceDue,
      tenantTotalCharges,
      tenantCollected,
      bookingPaymentItems: booking.bookingPaymentItems ?? null,
    };
  },
});

export const getBookingRequestsForOperator = query({
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

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", user._id))
      .collect();

    const results = [];
    for (const prop of properties) {
      const bookings = await ctx.db
        .query("bookingRequests")
        .withIndex("by_propertyId", (q) => q.eq("propertyId", prop._id))
        .order("desc")
        .collect();
      for (const b of bookings) {
        const coverImageUrl = await getStorageUrl(ctx, prop.images?.[0]);
        results.push({
          _id: b._id,
          propertyId: b.propertyId,
          propertyName: prop.name,
          propertyCity: prop.city ?? null,
          coverImageUrl,
          studentName: b.studentName,
          studentPhone: b.studentPhone,
          studentEmail: b.studentEmail ?? null,
          course: b.course ?? null,
          yearOfStudy: b.yearOfStudy ?? null,
          parentName: b.parentName ?? null,
          parentPhone: b.parentPhone ?? null,
          moveInDate: b.moveInDate,
          foodPreference: b.foodPreference ?? null,
          roomTypePreference: b.roomTypePreference ?? null,
          paymentProofId: b.paymentProofId ?? null,
          paymentProofUrl: await getStorageUrl(ctx, b.paymentProofId ?? undefined),
          status: b.status,
          createdAt: b.createdAt,
          roomPricings: prop.roomPricings ?? null,
        });
      }
    }
    return results;
  },
});

export const updateBookingRequestStatus = mutation({
  args: {
    bookingId: v.id("bookingRequests"),
    status: v.union(v.literal("accepted"), v.literal("rejected")),
    bookingPaymentItems: v.optional(v.array(v.object({
      key: v.string(),
      label: v.string(),
      amount: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) throw new Error("User not found");

    if (args.bookingPaymentItems?.some((i) => i.amount < 0))
      throw new Error("Payment item amounts must be non-negative");

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");

    const property = await ctx.db.get(booking.propertyId);
    if (!property || property.operatorId !== user._id)
      throw new Error("Unauthorized");

    await ctx.db.patch(args.bookingId, {
      status: args.status,
      ...(args.bookingPaymentItems ? { bookingPaymentItems: args.bookingPaymentItems } : {}),
    });

    if (args.status === "accepted") {
      // Auto-create tenant record from booking data
      const items = args.bookingPaymentItems ?? booking.bookingPaymentItems ?? [];
      const getAmount = (key: string) =>
        items.find((i) => i.key === key)?.amount ?? undefined;

      // Check if tenant already exists for this booking (idempotency)
      const existing = await ctx.db
        .query("tenants")
        .withIndex("by_propertyId", (q) => q.eq("propertyId", booking.propertyId))
        .filter((q) => q.eq(q.field("studentPhone"), booking.studentPhone))
        .first();

      if (!existing) {
        const now = Date.now();

        // Booking amount the student already paid upfront (from property room pricing)
        const roomPricing = (property.roomPricings ?? []).find(
          (rp) => rp.roomType === booking.roomTypePreference
        );
        const paidBookingAmount = roomPricing?.bookingAmount
          ? Number(roomPricing.bookingAmount)
          : 0;

        const initialHistory = paidBookingAmount > 0 ? [{
          id: `booking-${args.bookingId}`,
          amount: paidBookingAmount,
          status: "paid" as const,
          note: "Booking amount paid",
          createdAt: now,
        }] : undefined;

        // Map unknown keys to customCharges so all items are accounted for
        const knownKeys = new Set(["rent", "security", "advance", "booking", "maintenance"]);
        const customCharges = items
          .filter((i) => !knownKeys.has(i.key))
          .map((i) => ({ id: i.key, label: i.label, amount: i.amount }));

        // Total charges = sum of operator-specified payment items
        const totalCharges = items.reduce((sum, i) => sum + i.amount, 0);
        const paymentStatus = totalCharges === 0 || paidBookingAmount >= totalCharges
          ? "paid" as const
          : paidBookingAmount > 0
          ? "partial" as const
          : "pending" as const;

        await ctx.db.insert("tenants", {
          propertyId: booking.propertyId,
          operatorId: user._id,
          studentName: booking.studentName,
          studentPhone: booking.studentPhone,
          studentEmail: booking.studentEmail,
          course: booking.course,
          parentName: booking.parentName,
          parentPhone: booking.parentPhone,
          parentEmail: booking.parentEmail,
          rent: getAmount("rent"),
          security: getAmount("security"),
          advance: getAmount("advance"),
          booking: getAmount("booking"),
          maintenance: getAmount("maintenance"),
          ...(customCharges.length > 0 ? { customCharges } : {}),
          paymentStatus,
          paymentHistory: initialHistory,
          createdAt: now,
        });
      }
    }

    return { success: true };
  },
});

export const getById = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.propertyId);
    if (!p) return null;

    const imageUrls: string[] = [];
    for (const imgId of p.images ?? []) {
      const url = await getStorageUrl(ctx, imgId);
      if (url) imageUrls.push(url);
    }
    const coverImageUrl = imageUrls[0] ?? null;

    const roomOptions = buildRoomOptions(p);
    const operator = await ctx.db.get(p.operatorId);

    return {
      _id: p._id,
      name: p.name,
      coverImageUrl,
      imageUrls,
      pincode: p.pincode ?? null,
      city: p.city ?? null,
      state: p.state ?? null,
      line1: p.addressLine1 ?? null,
      description: p.description ?? null,
      propertyType: p.propertyType,
      contactPhone: operator?.phone ?? null,
      contactEmail: operator?.email ?? null,
      roomOptions,
      roomPricings: (p.roomPricings ?? []).map((rp) => ({
        roomType: rp.roomType,
        bookingAmount: rp.bookingAmount ?? null,
      })),
      tenantDetails: getTenantDetails(p),
      agreement: {
        agreementDuration: p.agreementDuration ?? null,
        noticePeriod: p.noticePeriod ?? null,
        securityDepositDuration: null,
        lockInPeriod: null,
      },
    };
  },
});
