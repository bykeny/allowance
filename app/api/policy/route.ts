import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Policy } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(db.getPolicy());
}

export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  const patch: Partial<Policy> = {};
  if (Number.isFinite(b.autoApproveLimit) && b.autoApproveLimit >= 0) patch.autoApproveLimit = b.autoApproveLimit;
  if (Number.isFinite(b.dailyBudget) && b.dailyBudget >= 0) patch.dailyBudget = b.dailyBudget;
  if (Array.isArray(b.vendorAllowlist)) patch.vendorAllowlist = b.vendorAllowlist.map(String);
  if (Array.isArray(b.blockedCategories)) patch.blockedCategories = b.blockedCategories.map(String);
  return NextResponse.json(db.setPolicy(patch));
}
