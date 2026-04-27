import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

/* ------------------------------------------------------------------ */
/*  Helper: get current user from auth identity                        */
/* ------------------------------------------------------------------ */
async function getCurrentUserDoc(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const tokenIdentifier = identity.tokenIdentifier;
  if (!tokenIdentifier) throw new Error("Missing tokenIdentifier");

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", tokenIdentifier),
    )
    .unique();

  if (!user) throw new Error("User not found");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Generate an upload URL (called by the client before uploading)     */
/* ------------------------------------------------------------------ */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getCurrentUserDoc(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/* ------------------------------------------------------------------ */
/*  Query import status (polled by the client)                         */
/* ------------------------------------------------------------------ */
export const getImportStatus = query({
  args: { importId: v.id("bulkImports") },
  handler: async (ctx, { importId }) => {
    return await ctx.db.get(importId);
  },
});

export const getLatestImport = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserDoc(ctx);
    return await ctx.db
      .query("bulkImports")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .first();
  },
});

export const getImportedTenantsForProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);
    const property = await ctx.db.get(args.propertyId);
    if (!property || property.userId !== user._id) return [];
    return await ctx.db
      .query("importedTenants")
      .withIndex("by_property", (q: any) => q.eq("propertyId", args.propertyId))
      .take(500);
  },
});

/* ================================================================== */
/*  INTERNAL MUTATIONS (called from the action in bulkImportAction.ts) */
/* ================================================================== */

export const createImportRecord = internalMutation({
  args: {
    fileId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, { fileId, fileName }) => {
    const user = await getCurrentUserDoc(ctx);
    const id = await ctx.db.insert("bulkImports", {
      userId: user._id,
      fileId,
      fileName,
      status: "pending",
    });
    return id;
  },
});

export const updateImportStatus = internalMutation({
  args: {
    importId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { importId, status, error }) => {
    await ctx.db.patch(importId as any, {
      status,
      ...(error !== undefined ? { error } : {}),
    });
  },
});

interface ParsedTenant {
  name: string;
  phone?: string;
  email?: string;
  roomNumber?: string;
  roomType?: string;
  rent?: number;
  deposit?: number;
  agreementDuration?: number;
  moveInDate?: string;
  paymentStatus?: "paid" | "pending";
}

interface ParsedImportData {
  propertyName?: string;
  city?: string;
  state?: string;
  agreementDuration?: number;
  securityDepositDuration?: number;
  tenants: ParsedTenant[];
}

function mapRoomCategory(roomType?: string): string {
  if (!roomType) return "single";
  const lower = roomType.toLowerCase().trim();
  if (lower.includes("single") || lower === "1") return "single";
  if (lower.includes("double") || lower === "2") return "double";
  if (lower.includes("triple") || lower === "3") return "triple";
  if (lower.includes("3plus") || lower.includes("quad") || parseInt(lower) > 3)
    return "3plus";
  return "single";
}

function extractFloorNumber(roomNumber?: string): number {
  if (!roomNumber) return 0;
  const cleaned = roomNumber.replace(/[^0-9]/g, "");
  if (cleaned.length >= 3) {
    return parseInt(cleaned[0], 10) || 0;
  }
  return 0;
}

export const insertParsedData = internalMutation({
  args: {
    importId: v.string(),
    data: v.string(),
  },
  handler: async (ctx, { importId, data }) => {
    const user = await getCurrentUserDoc(ctx);
    const parsed: ParsedImportData = JSON.parse(data);

    // 1. Create property
    const propertyId = await ctx.db.insert("properties", {
      userId: user._id,
      name: parsed.propertyName || "Imported Property",
      totalUnits: parsed.tenants.length,
      vacantUnits: 0,
      city: parsed.city || undefined,
      state: parsed.state || undefined,
    });

    // Set as primary property
    await ctx.db.patch(user._id, { primaryPropertyId: propertyId });

    // 2. Create onboarding profile if not exists
    const existingProfile = await ctx.db
      .query("onboardingProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .unique();

    if (!existingProfile) {
      await ctx.db.insert("onboardingProfiles", {
        userId: user._id,
        fullName: user.name || "",
        totalUnits: parsed.tenants.length,
        totalProperties: 1,
        status: "draft",
      });
    }

    // 3. Collect unique room types and build room options
    const roomTypeMap = new Map<
      string,
      { category: string; rentAmount: number; count: number }
    >();

    for (const tenant of parsed.tenants) {
      const key = mapRoomCategory(tenant.roomType);
      const existing = roomTypeMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        roomTypeMap.set(key, {
          category: key,
          rentAmount: tenant.rent || 0,
          count: 1,
        });
      }
    }

    const roomOptionIds = new Map<string, any>();
    for (const [key, opt] of roomTypeMap) {
      const roomOptionId = await ctx.db.insert("roomOptions", {
        propertyId,
        category: opt.category,
        numberOfRooms: opt.count,
        typeName:
          opt.category === "single"
            ? "Single Room"
            : opt.category === "double"
              ? "Double Room"
              : opt.category === "triple"
                ? "Triple Room"
                : "Shared Room",
        rentAmount: opt.rentAmount,
      });
      roomOptionIds.set(key, roomOptionId);
    }

    // 4. Create agreement details if provided
    if (parsed.agreementDuration) {
      await ctx.db.insert("propertyAgreement", {
        propertyId,
        agreementDuration: String(parsed.agreementDuration),
        securityDepositDuration: parsed.securityDepositDuration
          ? String(parsed.securityDepositDuration)
          : undefined,
      });
    }

    // 5. Create rent details
    await ctx.db.insert("propertyRent", {
      propertyId,
      monthlyRentalCycle: "01 - 01",
      gracePeriodDays: 5,
      hasLateFee: false,
    });

    // 6. Create floors and rooms for each tenant, then create move-in applications
    const floorMap = new Map<number, any>();
    let importedCount = 0;

    for (const tenant of parsed.tenants) {
      const floorNumber = extractFloorNumber(tenant.roomNumber);

      if (!floorMap.has(floorNumber)) {
        const floorId = await ctx.db.insert("floors", {
          propertyId,
          floorNumber,
          label:
            floorNumber === 0 ? "Ground Floor" : `Floor ${floorNumber}`,
        });
        floorMap.set(floorNumber, floorId);
      }

      const floorId = floorMap.get(floorNumber)!;
      const roomTypeKey = mapRoomCategory(tenant.roomType);
      const roomOptionId = roomOptionIds.get(roomTypeKey);

      const roomNumber =
        tenant.roomNumber ||
        `${floorNumber}${String(importedCount + 1).padStart(2, "0")}`;

      const roomId = await ctx.db.insert("rooms", {
        propertyId,
        floorId,
        roomOptionId,
        roomNumber,
        displayName: tenant.roomNumber || undefined,
        category: mapRoomCategory(tenant.roomType),
      });

      // Store tenant in importedTenants table (no user account created)
      await ctx.db.insert("importedTenants", {
        operatorId: user._id,
        propertyId,
        roomId,
        roomNumber,
        name: tenant.name,
        phone: tenant.phone || undefined,
        email: tenant.email || undefined,
        roomType: tenant.roomType || undefined,
        rent: tenant.rent || undefined,
        deposit: tenant.deposit || undefined,
        moveInDate: tenant.moveInDate || undefined,
        agreementDuration: tenant.agreementDuration || undefined,
        paymentStatus: (tenant.paymentStatus === "paid" || tenant.paymentStatus === "pending") ? tenant.paymentStatus : undefined,
        importId: importId as any,
      });

      importedCount++;
    }

    // 7. Update import record
    await ctx.db.patch(importId as any, {
      status: "completed",
      totalRows: parsed.tenants.length,
      importedRows: importedCount,
      propertyId,
      parsedData: data,
    });
  },
});
