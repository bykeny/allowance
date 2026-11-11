import { NextResponse } from "next/server";
import { requestPurchase } from "@/lib/purchase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (process.env.ALLOW_DEV_ROUTES !== "1") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.item_id !== "string" || !body.item_id.trim()) {
    return NextResponse.json({ error: "item_id is required" }, { status: 400 });
  }

  const justification = typeof body.justification === "string" && body.justification.trim()
    ? body.justification.trim()
    : "Dev purchase";

  const result = await requestPurchase({
    item_id: body.item_id.trim(),
    justification,
  });

  return NextResponse.json(result);
}

