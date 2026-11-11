"use client";
import { useEffect, useRef, useState } from "react";

interface Trace {
  name: string;
  input: unknown;
  output: unknown;
}
interface Msg {
  role: "user" | "agent" | "error";
  text: string;
  trace?: Trace[];
}

const EXAMPLES = [
  "Buy a .com domain for our launch",
  "We need the Analytics Growth plan",
  "Get a $40 gift card for the team raffle",
];

export default function Chat({ onActivity }: { onActivity: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setText("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: message }]);
    try {
      const r = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const j = await r.json().catch(() => ({ error: `The agent returned an unreadable response (HTTP ${r.status}).` }));
      setMsgs((m) => [
        ...m,
        r.ok && !j.error
          ? { role: "agent", text: j.reply ?? "", trace: j.trace }
          : { role: "error", text: j.error ?? `Agent request failed (HTTP ${r.status}).` },
      ]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "error", text: `Could not reach the agent: ${String(e)}` }]);
    } finally {
      setBusy(false);
      onActivity();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.length === 0 && (
          <div className="space-y-2 pt-6 text-sm text-stone-500">
            <p>Give the agent a goal. It can shop, but the policy decides what gets paid.</p>
            {EXAMPLES.map((e) => (
              <button
                key={e}
                onClick={() => send(e)}
                className="block w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-stone-700 hover:border-stone-400"
              >
                {e}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                m.role === "user"
                  ? "bg-stone-900 text-white"
                  : m.role === "error"
                    ? "border border-red-200 bg-red-50 text-red-800"
                    : "border border-stone-200 bg-white"
              }`}
            >
              {m.trace && m.trace.length > 0 && (
                <div className="mb-2 space-y-1">
                  {m.trace.map((t, k) => (
                    <details key={k} className="rounded bg-stone-50 px-2 py-1 font-mono text-[11px] text-stone-600">
                      <summary className="cursor-pointer">
                        {t.name}
                        {toolBadge(t)}
                      </summary>
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">{JSON.stringify({ input: t.input, output: t.output }, null, 2)}</pre>
                    </details>
                  ))}
                </div>
              )}
              {m.text}
            </div>
          </div>
        ))}
        {busy && <div className="animate-pulse text-sm text-stone-400">Agent is working…</div>}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex gap-2 border-t border-stone-200 bg-white p-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask the agent to buy something…"
          className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
        />
        <button disabled={busy} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
          Send
        </button>
      </form>
    </div>
  );
}

function toolBadge(t: Trace) {
  const d = (t.output as { decision?: string } | null)?.decision;
  if (t.name !== "request_purchase" || !d) return null;
  const color = d === "ALLOW" ? "text-emerald-700" : d === "ESCALATE" ? "text-amber-700" : "text-red-700";
  return <span className={`ml-2 font-semibold ${color}`}>{d}</span>;
}
