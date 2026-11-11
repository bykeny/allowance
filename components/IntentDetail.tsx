"use client";
import { useEffect, useState } from "react";
import type { Intent } from "@/lib/types";

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  CAPTURED: { label: "✓ Paid", cls: "bg-emerald-600 text-white" },
  AWAITING_HUMAN: { label: "Awaiting approval", cls: "bg-amber-400 text-amber-950" },
  REQUESTED: { label: "Processing…", cls: "bg-amber-400 text-amber-950" },
  DENIED: { label: "✕ Denied", cls: "bg-red-600 text-white" },
  FAILED: { label: "✕ Failed", cls: "bg-red-600 text-white" },
  CANCELLED: { label: "Cancelled", cls: "bg-stone-300 text-stone-700" },
};

const VERDICT_STYLE: Record<string, string> = {
  ALLOW: "border-emerald-300 bg-emerald-50 text-emerald-900",
  ESCALATE: "border-amber-300 bg-amber-50 text-amber-900",
  DENY: "border-red-300 bg-red-50 text-red-900",
};

const VERDICT_HEADLINE: Record<string, string> = {
  ALLOW: "Allowed by policy",
  ESCALATE: "Escalated to a human",
  DENY: "Denied by policy",
};

const EVENT_LABEL: Record<string, string> = {
  requested: "Agent requested purchase",
  policy_verdict: "Policy verdict",
  order_created: "PayPal order created",
  approved_by_human: "Approved by a human in PayPal",
  captured: "Payment captured",
  cancelled: "Cancelled in PayPal",
  failed: "Failed",
  webhook_received: "PayPal webhook received",
  wallet_linked: "PayPal wallet linked",
};

const EVENT_DOT: Record<string, string> = {
  captured: "bg-emerald-500",
  approved_by_human: "bg-emerald-500",
  failed: "bg-red-500",
  cancelled: "bg-stone-400",
  policy_verdict: "bg-stone-900",
};

function CopyField({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-stone-500">{label}</span>
      {value ? (
        <span className="flex items-center gap-2">
          <code className="font-mono text-xs text-stone-900">{value}</code>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              } catch {
                /* clipboard unavailable (insecure context); the ID is still selectable */
              }
            }}
            className="rounded border border-stone-300 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 hover:border-stone-500"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </span>
      ) : (
        <span className="text-xs text-stone-400">none</span>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-stone-200 px-5 py-4">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{title}</h3>
      {children}
    </section>
  );
}

export default function IntentDetail({ intent, onClose }: { intent: Intent; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const status = STATUS_STYLE[intent.status] ?? { label: intent.status, cls: "bg-stone-200 text-stone-700" };
  const events = [...(intent.events ?? [])].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <aside
      aria-label="Purchase details"
      className="flex h-full w-[400px] shrink-0 flex-col overflow-hidden border-l border-stone-200 bg-white shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.15)]"
    >
      <header className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0">
          <div className="text-xs text-stone-500">
            {intent.vendor} · {intent.category}
          </div>
          <h2 className="mt-0.5 text-lg font-semibold leading-tight text-stone-900">{intent.itemName}</h2>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xl font-semibold tabular-nums text-stone-900">
              {intent.currency} {intent.amount.toFixed(2)}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status.cls}`}>{status.label}</span>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close details" className="rounded-md px-2 py-1 text-lg leading-none text-stone-400 hover:bg-stone-100 hover:text-stone-700">
          ×
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {intent.status === "AWAITING_HUMAN" && intent.approveUrl && (
          <div className="px-5 pb-4">
            <a
              href={intent.approveUrl}
              className="approve-btn block rounded-lg bg-[#0070ba] px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-[#005ea6]"
            >
              Approve in PayPal →
            </a>
          </div>
        )}

        <Section title="Why the agent wanted it">
          <blockquote className="border-l-2 border-stone-300 pl-3 text-sm italic text-stone-700">{intent.justification || "No justification given."}</blockquote>
        </Section>

        <Section title="Policy decision">
          {intent.decision ? (
            <div className={`rounded-lg border px-3 py-2.5 ${VERDICT_STYLE[intent.decision] ?? ""}`}>
              <div className="text-sm font-semibold">
                {intent.decision} · {VERDICT_HEADLINE[intent.decision]}
              </div>
              {intent.reason && <div className="mt-0.5 text-sm">{intent.reason}</div>}
            </div>
          ) : (
            <div className="text-sm text-stone-500">No verdict yet.</div>
          )}
          {intent.error && (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <span className="font-semibold">Error: </span>
              {intent.error}
            </div>
          )}
        </Section>

        <Section title="PayPal">
          <div className="divide-y divide-stone-100">
            <CopyField label="Order ID" value={intent.orderId} />
            <CopyField label="Capture ID" value={intent.captureId} />
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-stone-500">Paid via</span>
              <span className="text-xs text-stone-900">
                {intent.paidVia === "VAULT" ? "Linked wallet (no human)" : intent.paidVia === "HUMAN_APPROVAL" ? "Human approval" : "not paid"}
              </span>
            </div>
          </div>
        </Section>

        <Section title="Timeline">
          {events.length === 0 ? (
            <div className="text-sm text-stone-500">No events recorded for this request.</div>
          ) : (
            <ol className="relative ml-1 border-l border-stone-200">
              {events.map((ev, i) => (
                <li key={i} className="mb-3 ml-4 last:mb-0">
                  <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${EVENT_DOT[ev.type] ?? "bg-stone-400"}`} />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-stone-900">{EVENT_LABEL[ev.type] ?? ev.type}</span>
                    <time className="shrink-0 font-mono text-[11px] text-stone-500">{new Date(ev.at).toLocaleTimeString()}</time>
                  </div>
                  {ev.detail && <div className="mt-0.5 break-words text-xs text-stone-600">{ev.detail}</div>}
                </li>
              ))}
            </ol>
          )}
        </Section>

        <div className="px-5 pb-5 pt-1 font-mono text-[10px] text-stone-400">intent {intent.id}</div>
      </div>
    </aside>
  );
}
