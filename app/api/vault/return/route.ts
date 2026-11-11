import { NextResponse } from "next/server";
import { createPaymentToken } from "@/lib/paypal";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const home = (q: string) => NextResponse.redirect(`${process.env.APP_URL ?? "http://localhost:3000"}/?wallet=${q}`);

// PayPal sends the buyer back here after they approve saving their wallet.
export async function GET() {
  const setupToken = db.getPendingSetupToken();
  if (!setupToken) return home("missing");
  try {
    db.setVaultId(await createPaymentToken(setupToken));
    db.setPendingSetupToken(undefined);
    return home("linked");
  } catch (e) {
    console.error("vault return failed", e);
    return home("error");
  }
}
