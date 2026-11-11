import { NextResponse } from "next/server";
import { resetChat, runAgent } from "@/lib/agent";
import { db } from "@/lib/db";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.reset) {
    resetChat();
    db.reset();
    return NextResponse.json({ ok: true });
  }
  if (typeof body.message !== "string" || !body.message.trim())
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  try {
    return NextResponse.json(await runAgent(body.message.trim()));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
