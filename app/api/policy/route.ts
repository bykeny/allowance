import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCatalogCategories, getCatalogVendors } from "@/lib/catalog";
import type { Policy } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(db.getPolicy());
}

export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  const patch: Partial<Policy> = {};

  if ("autoApproveLimit" in b) {
    if (typeof b.autoApproveLimit !== "number" || !Number.isFinite(b.autoApproveLimit) || b.autoApproveLimit < 0) {
      return NextResponse.json({ error: "autoApproveLimit must be a non-negative number" }, { status: 400 });
    }
    patch.autoApproveLimit = b.autoApproveLimit;
  }

  if ("dailyBudget" in b) {
    if (typeof b.dailyBudget !== "number" || !Number.isFinite(b.dailyBudget) || b.dailyBudget < 0) {
      return NextResponse.json({ error: "dailyBudget must be a non-negative number" }, { status: 400 });
    }
    patch.dailyBudget = b.dailyBudget;
  }

  if ("vendorAllowlist" in b) {
    if (!Array.isArray(b.vendorAllowlist)) {
      return NextResponse.json({ error: "vendorAllowlist must be an array of strings" }, { status: 400 });
    }
    const validVendors = getCatalogVendors();
    const unknown = b.vendorAllowlist.filter((v: unknown) => typeof v !== "string" || !validVendors.includes(v));
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: `Unknown vendor(s): ${unknown.join(", ")}. Valid vendors: ${validVendors.join(", ")}` },
        { status: 400 }
      );
    }
    patch.vendorAllowlist = b.vendorAllowlist.map(String);
  }

  if ("blockedCategories" in b) {
    if (!Array.isArray(b.blockedCategories)) {
      return NextResponse.json({ error: "blockedCategories must be an array of strings" }, { status: 400 });
    }
    const validCategories = getCatalogCategories();
    const unknown = b.blockedCategories.filter((c: unknown) => typeof c !== "string" || !validCategories.includes(c));
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: `Unknown category(ies): ${unknown.join(", ")}. Valid categories: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }
    patch.blockedCategories = b.blockedCategories.map(String);
  }

  return NextResponse.json(db.setPolicy(patch));
}
