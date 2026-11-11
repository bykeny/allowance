"use client";
import { useEffect, useRef, useState } from "react";

interface Step {
  name: string;
  input: unknown;
  output?: unknown;
  done: boolean;
}
interface Msg {
  role: "user" | "agent" | "error";
  text: string;
  steps?: Step[];
  working?: boolean;
}

const EXAMPLES = [
  "Buy a .com domain for our launch",
  "We need the Analytics Growth plan",
  "Get a $40 gift card for the team raffle",
  "Set up our launch site: domain, hosting and analytics",
];

const TOOL_LABEL: Record<string, string> = {
  search_catalog: "Searching the catalog",
  get_budget_status: "Checking today's budget",
  request_purchase: "Requesting purchase",
  check_purchase_status: "Checking purchase status",
};

/** Thrown when the stream endpoint can't be used at all, before the agent ran. Safe to fall back. */
class StreamUnavailable extends Error {}

export default function Chat({ onActivity, onReset }: { onActivity: () => void; onReset: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  /** Update the in-progress agent message (always the last one). */
  const patchLast = (fn: (m: Msg) => Msg) =>
    setMsgs((all) => {
      const i = all.length - 1;
      if (i < 0 || all[i].role !== "agent") return all;
      const next = all.slice();
      next[i] = fn(all[i]);
      return next;
    });

  async function sendStream(message: string) {
    let r: Response;
    try {
      r = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
    } catch (e) {
      throw new StreamUnavailable(String(e));
    }
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      // A 4xx/5xx with a JSON error came from the route itself: report it, don't retry.
      if (j?.error) throw new Error(j.error);
      throw new StreamUnavailable(`HTTP ${r.status}`);
    }
    if (!r.body || !r.headers.get("content-type")?.includes("text/event-stream")) throw new StreamUnavailable("not an event stream");

    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let finished = false;
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let sep: number;
      while ((sep = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        let event = "message";
        let data = "";
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        const payload = data ? JSON.parse(data) : {};
        if (event === "tool_start") {
          patchLast((m) => ({ ...m, steps: [...(m.steps ?? []), { name: payload.name, input: payload.input, done: false }] }));
        } else if (event === "tool_result") {
          patchLast((m) => {
            const steps = (m.steps ?? []).slice();
            const i = steps.findIndex((s) => !s.done && s.name === payload.name);
            if (i >= 0) steps[i] = { ...steps[i], output: payload.output, done: true };
            else steps.push({ name: payload.name, input: {}, output: payload.output, done: true });
            return { ...m, steps };
          });
          onActivity(); // purchases land in the ledger as they happen
        } else if (event === "text") {
          patchLast((m) => ({ ...m, text: m.text + (payload.delta ?? "") }));
        } else if (event === "error") {
          throw new Error(payload.message ?? "The agent failed.");
        } else if (event === "done") {
          finished = true;
        }
      }
    }
    if (!finished) throw new Error("The connection to the agent closed before it finished. Check the ledger for what happened.");
  }

  async function sendPlain(message: string) {
    const r = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const j = await r.json().catch(() => ({ error: `The agent returned an unreadable response (HTTP ${r.status}).` }));
    if (!r.ok || j.error) throw new Error(j.error ?? `Agent request failed (HTTP ${r.status}).`);
    const steps: Step[] = (j.trace ?? []).map((t: { name: string; input: unknown; output: unknown }) => ({ ...t, done: true }));
    patchLast((m) => ({ ...m, text: j.reply ?? "", steps }));
  }

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setText("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: message }, { role: "agent", text: "", steps: [], working: true }]);
    try {
      try {
        await sendStream(message);
      } catch (e) {
        // Only fall back when the stream never reached the agent; otherwise a retry could buy twice.
        if (!(e instanceof StreamUnavailable)) throw e;
        await sendPlain(message);
      }
      patchLast((m) => ({ ...m, working: false }));
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      setMsgs((all) => {
        const last = all[all.length - 1];
        const keep = last?.role === "agent" && (last.steps?.length || last.text) ? [...all.slice(0, -1), { ...last, working: false }] : all.slice(0, -1);
        return [...keep, { role: "error", text: err }];
      });
    } finally {
      setBusy(false);
      onActivity();
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2.5">
        <span className="text-sm font-semibold text-stone-900">Agent</span>
        <button
          type="button"
          onClick={onReset}
          disabled={busy}
          title="Clears the chat, the agent's memory and the ledger"
          className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-40"
        >
          Reset demo
        </button>
      </div>
      <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-4">
        {msgs.length === 0 && (
          <div className="space-y-2 pt-4 text-sm text-stone-500">
            <p className="text-stone-700">
              Give the agent a goal. It can shop, but <span className="font-semibold text-stone-900">the policy decides what gets paid.</span>
            </p>
            <p className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">Try</p>
            {EXAMPLES.map((e) => (
              <button
                key={e}
                onClick={() => send(e)}
                disabled={busy}
                className="block w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-left text-stone-700 transition hover:border-stone-400 hover:shadow-sm disabled:opacity-50"
              >
                {e}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex min-w-0 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`min-w-0 max-w-[92%] whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-xl px-3.5 py-2 text-sm ${
                m.role === "user"
                  ? "bg-stone-900 text-white"
                  : m.role === "error"
                    ? "border border-red-200 bg-red-50 text-red-800"
                    : "border border-stone-200 bg-white text-stone-800 shadow-sm"
              }`}
            >
              {m.steps && m.steps.length > 0 && (
                <ol className={`space-y-1 ${m.text || m.working ? "mb-2" : ""}`}>
                  {m.steps.map((s, k) => (
                    <StepRow key={k} step={s} />
                  ))}
                </ol>
              )}
              {m.role === "agent" ? renderBold(m.text) : m.text}
              {m.working && !m.text && (
                <span className="inline-flex items-center gap-2 text-stone-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-stone-400" />
                  {m.steps?.length ? "Working…" : "Thinking…"}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="shrink-0 border-t border-stone-200 bg-white">
        <div className="flex flex-wrap gap-1.5 px-3 pt-3">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => send(e)}
              disabled={busy}
              className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] text-stone-600 transition hover:border-stone-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {e}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex gap-2 p-3"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask the agent to buy something…"
            className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#0070ba]"
          />
          <button disabled={busy || !text.trim()} className="rounded-lg bg-[#0070ba] px-4 py-2 text-sm font-medium text-white hover:bg-[#005ea6] disabled:opacity-40">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

/** Renders **bold** spans without a markdown library. */
function renderBold(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part
  );
}

function StepRow({ step }: { step: Step }) {
  const out = step.output as { decision?: string; error?: string; name?: string } | undefined;
  const input = step.input as { item_id?: string; query?: string } | undefined;
  const detail = step.name === "request_purchase" ? input?.item_id : step.name === "search_catalog" ? input?.query : undefined;
  const d = out?.decision;
  const badge =
    d === "ALLOW" ? "bg-emerald-600 text-white" : d === "ESCALATE" ? "bg-amber-400 text-amber-950" : d === "DENY" ? "bg-red-600 text-white" : "";
  return (
    <li>
      <details className="min-w-0 rounded-md bg-stone-50 px-2 py-1 text-[11px] text-stone-600">
        <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2">
          {step.done ? (
            <span className={out?.error ? "text-red-600" : "text-emerald-600"}>{out?.error ? "✕" : "✓"}</span>
          ) : (
            <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
          )}
          <span className="whitespace-nowrap font-medium text-stone-700">{TOOL_LABEL[step.name] ?? step.name}</span>
          {detail && (
            <code title={detail} className="min-w-0 truncate font-mono text-stone-500">
              {detail}
            </code>
          )}
          {d && <span className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${badge}`}>{d}</span>}
        </summary>
        <pre className="mt-1 whitespace-pre-wrap break-words font-mono [overflow-wrap:anywhere]">{JSON.stringify({ input: step.input, output: step.output }, null, 2)}</pre>
      </details>
    </li>
  );
}
