import { NextResponse, type NextRequest } from "next/server";
import { createPaymentToken, PayPalError } from "@/lib/paypal";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const home = (q: string) => NextResponse.redirect(`${process.env.APP_URL ?? "http://localhost:3000"}/?wallet=${q}`);

// PayPal sends the buyer back here after they approve (or cancel) saving their wallet.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  // PayPal does not document the return params; log the keys only (never values).
  console.log("vault return params:", [...q.keys()].join(",") || "(none)");

  if (q.has("cancelled")) {
    db.setPendingSetupToken(undefined);
    return home("cancelled");
  }

  const pending = db.getPendingSetupToken();
  const fromQuery = q.get("approval_token_id") ?? q.get("approval_session_id") ?? undefined;
  if (fromQuery && pending && fromQuery !== pending) {
    console.error("vault return: setup token in query does not match the pending one");
    return home("error");
  }
  const setupToken = fromQuery ?? pending;
  if (!setupToken) return home("missing");

  try {
    db.setVaultId(await createPaymentToken(setupToken));
    db.setPendingSetupToken(undefined);
    return home("linked");
  } catch (e) {
    if (e instanceof PayPalError) console.error(`vault return failed: ${e.name} debug_id=${e.debugId ?? "(none)"}`);
    else console.error("vault return failed:", e instanceof Error ? e.message : String(e));
    db.setPendingSetupToken(undefined);
    return home("error");
  }
}
