import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/paypal";
import { db } from "@/lib/db";

// Subscribe this URL to PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.DENIED
// and PAYMENT.CAPTURE.REFUNDED in the sandbox app's webhook settings.
export async function POST(req: Request) {
  const event = await req.json().catch(() => null);
  if (!event) return NextResponse.json({ error: "bad json" }, { status: 400 });

  let ok = false;
  try {
    ok = await verifyWebhook(req.headers, event);
  } catch (e) {
    console.error("webhook verify failed", e);
  }
  if (!ok) return NextResponse.json({ error: "signature not verified" }, { status: 400 });

  const intentId: string | undefined = event.resource?.custom_id;
  const intent = intentId ? db.getIntent(intentId) : undefined;
  if (intent) {
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED")
      db.updateIntent(intent.id, { status: "CAPTURED", captureId: event.resource.id, approveUrl: undefined });
    else if (event.event_type === "PAYMENT.CAPTURE.DENIED")
      db.updateIntent(intent.id, { status: "FAILED", error: "Capture denied by PayPal" });
  }
  return NextResponse.json({ received: true });
}
