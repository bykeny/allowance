import { NextResponse } from "next/server";
import { createSetupToken } from "@/lib/paypal";
import { db } from "@/lib/db";

// Start linking a PayPal wallet. The client redirects the buyer to approveUrl.
export async function POST() {
  try {
    const t = await createSetupToken();
    db.setPendingSetupToken(t.id);
    return NextResponse.json({ approveUrl: t.approveUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// Unlink.
export async function DELETE() {
  db.setVaultId(undefined);
  return NextResponse.json({ ok: true });
}
