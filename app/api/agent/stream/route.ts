import { runAgent } from "@/lib/agent";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.message !== "string" || !body.message.trim())
    return Response.json({ error: "message is required" }, { status: 400 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const { reply } = await runAgent(body.message.trim(), {
          onToolStart: (name, input) => send("tool_start", { name, input }),
          onToolResult: (name, output) => send("tool_result", { name, output }),
        });
        send("text", { delta: reply });
        send("done", {});
      } catch (e) {
        send("error", { message: e instanceof Error ? e.message : String(e) });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
