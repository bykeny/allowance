import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    intents: db.listIntents(),
    policy: db.getPolicy(),
    spentToday: db.spentToday(),
    walletLinked: !!db.getVaultId(),
  });
}
