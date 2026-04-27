"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as XLSX from "xlsx";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Main action: upload → parse → AI → insert                         */
/* ------------------------------------------------------------------ */
export const startImport = action({
  args: {
    fileId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, { fileId, fileName }): Promise<string> => {
    // Create the import record
    const importId: string = await ctx.runMutation(
      internal.bulkImport.createImportRecord,
      { fileId, fileName },
    );

    // Download the file from storage
    const fileUrl = await ctx.storage.getUrl(fileId);
    if (!fileUrl) throw new Error("Could not get file URL");

    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();

    // Parse XLSX / CSV into text
    const textContent = parseSpreadsheet(arrayBuffer, fileName);

    // Update status to processing
    await ctx.runMutation(internal.bulkImport.updateImportStatus, {
      importId,
      status: "processing",
    });

    // Call Gemini AI to analyze & structure the data
    let parsed: ParsedImportData;
    try {
      parsed = await analyzeWithGemini(textContent);
    } catch (e: any) {
      await ctx.runMutation(internal.bulkImport.updateImportStatus, {
        importId,
        status: "failed",
        error: `AI analysis failed: ${e.message}`,
      });
      throw e;
    }

    // Insert all data into the database
    try {
      await ctx.runMutation(internal.bulkImport.insertParsedData, {
        importId,
        data: JSON.stringify(parsed),
      });
    } catch (e: any) {
      await ctx.runMutation(internal.bulkImport.updateImportStatus, {
        importId,
        status: "failed",
        error: `Data insertion failed: ${e.message}`,
      });
      throw e;
    }

    return importId;
  },
});

/* ================================================================== */
/*  SPREADSHEET PARSING                                                */
/* ================================================================== */

function parseSpreadsheet(buffer: ArrayBuffer, fileName: string): string {
  if (fileName.toLowerCase().endsWith(".csv")) {
    return Buffer.from(buffer).toString("utf-8");
  }

  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("Empty spreadsheet");

  return XLSX.utils.sheet_to_csv(firstSheet);
}

/* ================================================================== */
/*  GEMINI AI ANALYSIS                                                 */
/* ================================================================== */

async function analyzeWithGemini(
  csvContent: string,
): Promise<ParsedImportData> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not set. Add it to your Convex environment variables.",
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are a data extraction assistant for a property management app. Analyze the following CSV/spreadsheet data and extract structured tenant and property information.

The data comes from a property operator who manages a PG/hostel/rental property. Extract the following information:

For the overall property (if detectable from the data):
- propertyName: Name of the property (if mentioned anywhere)
- city: City
- state: State
- agreementDuration: Default agreement duration in months
- securityDepositDuration: Security deposit duration in months

For each tenant row, extract:
- name: Tenant's full name (REQUIRED - skip row if no name)
- phone: Phone number
- email: Email address
- roomNumber: Room number (e.g. "101", "G01", "205")
- roomType: Room sharing type. Map to one of: "single", "double", "triple", "3plus". Detect from column names like "Single sharing", "Double sharing", "Room Type", "Sharing", "Bed type", etc.
- rent: Monthly rent amount (number only, no currency symbol)
- deposit: Security deposit amount (number only)
- agreementDuration: Agreement duration in months (number only)
- moveInDate: Move-in date in DD/MM/YYYY format
- paymentStatus: Current payment/rent status. Map to "paid" or "pending". Look for columns like "Payment Status", "Rent Status", "Status", "Payment", "Paid/Pending". If clearly paid/cleared map to "paid", if due/pending/unpaid map to "pending". Omit if not present.

IMPORTANT RULES:
- Be smart about column header matching. Headers might be in Hindi, abbreviated, or use different naming conventions.
- Common header variations: "Tenant Name"/"Name"/"Occupant", "Room No"/"Room #"/"Rm", "Rent"/"Monthly Rent"/"Rent Amount", "Deposit"/"Security Deposit"/"SD", "Duration"/"Agreement"/"Tenure"
- If a value is not present or unclear, omit the field (don't guess).
- Numbers should be plain numbers without commas or currency symbols.
- Skip completely empty rows.
- Room type defaults to "single" if not specified.

Return ONLY valid JSON (no markdown, no code fences) in this exact format:
{
  "propertyName": "string or null",
  "city": "string or null",
  "state": "string or null",
  "agreementDuration": null,
  "securityDepositDuration": null,
  "tenants": [
    {
      "name": "string",
      "phone": "string or null",
      "email": "string or null",
      "roomNumber": "string or null",
      "roomType": "single|double|triple|3plus",
      "rent": 0,
      "deposit": 0,
      "agreementDuration": 0,
      "moveInDate": "DD/MM/YYYY or null",
      "paymentStatus": "paid|pending|null"
    }
  ]
}

Here is the spreadsheet data:
${csvContent}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();

  // Strip markdown code fences if present
  let jsonStr = responseText;
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed: ParsedImportData;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(
      `Failed to parse AI response as JSON: ${jsonStr.slice(0, 200)}`,
    );
  }

  if (!parsed.tenants || !Array.isArray(parsed.tenants)) {
    throw new Error("AI response missing tenants array");
  }

  // Filter out tenants without names
  parsed.tenants = parsed.tenants.filter(
    (t) => t.name && t.name.trim().length > 0,
  );

  if (parsed.tenants.length === 0) {
    throw new Error(
      "No valid tenant rows found in the file. Make sure the file has a column for tenant names.",
    );
  }

  return parsed;
}
