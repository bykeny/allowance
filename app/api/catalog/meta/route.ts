import { NextResponse } from "next/server";
import { getCatalogMeta } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getCatalogMeta());
}
