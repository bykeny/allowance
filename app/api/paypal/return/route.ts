import { NextRequest, NextResponse } from "next/server";
import { captureIdOf, captureOrder } from "@/lib/paypal";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const home = () => NextResponse.redirect(`${process.env.APP_URL ?? "http://localhost:3000"}/`);

// A human approved (or cancelled) an escalated order in PayPal checkout.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const intent = db.getIntent(q.get("intent") ?? "");
  if (!intent?.orderId || intent.status !== "AWAITING_HUMAN") return home();

  if (q.get("cancelled")) {
    db.updateIntent(intent.id, { status: "CANCELLED", approveUrl: undefined });
    return home();
  }
  try {
    const captured = await captureOrder(intent.orderId);
    db.updateIntent(intent.id, {
      status: "CAPTURED",
      captureId: captureIdOf(captured),
      paidVia: "HUMAN_APPROVAL",
      approveUrl: undefined,
    });
  } catch (e) {
    db.updateIntent(intent.id, { status: "FAILED", error: e instanceof Error ? e.message : String(e) });
  }
  return home();
}
