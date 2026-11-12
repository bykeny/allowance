import { NextRequest, NextResponse } from "next/server";
import { captureOrder, captureResult, PayPalError } from "@/lib/paypal";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Outcome = "captured" | "cancelled" | "failed" | "ignored";
const home = (payment: Outcome) =>
  NextResponse.redirect(`${process.env.APP_URL ?? "http://localhost:3000"}/?payment=${payment}`);

// Intents with a capture in flight in this process: a double click captures once.
const inFlight = new Set<string>();

// A human approved (or cancelled) an escalated order in PayPal checkout.
// PayPal appends ?token=<orderId>&PayerID=... to our return_url (which already has ?intent=).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const intent = db.getIntent(q.get("intent") ?? "");
  // Unknown, already handled, or reloaded: never touch PayPal.
  if (!intent?.orderId || intent.status !== "AWAITING_HUMAN") return home("ignored");
  const token = q.get("token");
  if (token && token !== intent.orderId) return home("ignored");
  if (inFlight.has(intent.id)) return home("ignored");

  if (q.get("cancelled")) {
    db.updateIntent(intent.id, { status: "CANCELLED", approveUrl: undefined });
    db.addEvent(intent.id, "cancelled", "Human cancelled in PayPal");
    return home("cancelled");
  }

  inFlight.add(intent.id);
  try {
    const { captureId, captureStatus } = captureResult(await captureOrder(intent.orderId));
    if (captureStatus === "COMPLETED") {
      db.updateIntent(intent.id, {
        status: "CAPTURED",
        captureId,
        paidVia: "HUMAN_APPROVAL",
        approveUrl: undefined,
        error: undefined,
      });
      db.addEvent(intent.id, "captured", captureId);
      return home("captured");
    }
    if (captureStatus === "PENDING") {
      db.updateIntent(intent.id, { captureId, error: "Capture pending at PayPal", approveUrl: undefined });
      db.addEvent(intent.id, "capture_pending", captureId);
      return home("ignored");
    }
    db.updateIntent(intent.id, {
      status: "FAILED",
      captureId,
      approveUrl: undefined,
      error: `PayPal capture ${captureStatus ?? "missing"}`,
    });
    db.addEvent(intent.id, "failed", `PayPal capture ${captureStatus ?? "missing"}`);
    return home("failed");
  } catch (e) {
    const error =
      e instanceof PayPalError
        ? e.issue === "INSTRUMENT_DECLINED"
          ? "The buyer's payment method was declined"
          : `PayPal ${e.name}${e.issue ? ` / ${e.issue}` : ""} (debug_id ${e.debugId ?? "n/a"})`
        : e instanceof Error
          ? e.message
          : String(e);
    db.updateIntent(intent.id, { status: "FAILED", approveUrl: undefined, error });
    db.addEvent(intent.id, "failed", error);
    return home("failed");
  } finally {
    inFlight.delete(intent.id);
  }
}
