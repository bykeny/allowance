"use client";
import { useCallback, useEffect, useState } from "react";
import Chat from "@/components/Chat";
import IntentDetail from "@/components/IntentDetail";
import Ledger from "@/components/Ledger";
import PolicyBar from "@/components/PolicyBar";
import type { Intent, Policy } from "@/lib/types";

interface State {
  intents: Intent[];
  policy: Policy;
  spentToday: number;
  walletLinked: boolean;
}

export default function Home() {
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [offline, setOffline] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeDetail = useCallback(() => setSelectedId(null), []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/ledger", { cache: "no-store" });
      if (!r.ok) throw new Error(`Ledger request failed (HTTP ${r.status})`);
      setState(await r.json());
      setOffline(null);
    } catch (e) {
      // Keep the last good state on screen; the next poll retries.
      setOffline(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 1500);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh]);

  useEffect(() => {
    const w = new URLSearchParams(window.location.search).get("wallet");
    if (!w) return;
    window.history.replaceState({}, "", "/");
    const t = setTimeout(
      () =>
        setNotice(
          w === "linked"
            ? "PayPal wallet linked. In-policy purchases now pay without approval."
            : `Wallet linking did not complete (${w}).`
        ),
      0
    );
    return () => clearTimeout(t);
  }, []);

  /** Returns the server's validation error, or null when the policy was saved. */
  async function changePolicy(patch: Partial<Policy>): Promise<string | null> {
    let err: string | null = null;
    try {
      const r = await fetch("/api/policy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        err = j.error ?? `Policy update rejected (HTTP ${r.status}).`;
      }
    } catch (e) {
      err = `Could not reach the server: ${String(e)}`;
    }
    await refresh();
    return err;
  }

  async function linkWallet() {
    const r = await fetch("/api/vault/setup", { method: "POST" }).catch(() => null);
    const j = r ? await r.json().catch(() => ({ error: `Wallet linking failed (HTTP ${r.status}).` })) : { error: "Could not reach the server." };
    if (j.approveUrl) window.location.href = j.approveUrl;
    else setNotice(j.error ?? "Could not start wallet linking.");
  }

  async function unlinkWallet() {
    await fetch("/api/vault/setup", { method: "DELETE" });
    refresh();
  }

  async function reset() {
    await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset: true }) });
    setResetKey((k) => k + 1);
    setSelectedId(null);
    refresh();
  }

  if (!state)
    return (
      <div className="flex h-screen items-center justify-center">
        {offline ? (
          <div className="max-w-sm rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            <div className="font-semibold">Can&apos;t reach the Allowance server</div>
            <div className="mt-1 text-red-700">{offline}. Retrying every 1.5 seconds…</div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-stone-400" />
            Loading ledger…
          </div>
        )}
      </div>
    );

  const selected = selectedId ? state.intents.find((i) => i.id === selectedId) : undefined;

  return (
    <div className="flex h-screen flex-col">
      <PolicyBar
        policy={state.policy}
        spentToday={state.spentToday}
        walletLinked={state.walletLinked}
        onChange={changePolicy}
        onLinkWallet={linkWallet}
        onUnlinkWallet={unlinkWallet}
        onReset={reset}
      />
      {offline && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-800">
          Connection lost: {offline}. Showing the last known ledger; retrying…
        </div>
      )}
      {notice && (
        <button onClick={() => setNotice(null)} className="border-b border-sky-200 bg-sky-50 px-6 py-2 text-left text-sm text-sky-900">
          {notice} <span className="text-sky-600">(dismiss)</span>
        </button>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="w-[380px] shrink-0 border-r border-stone-200">
          <Chat key={resetKey} onActivity={refresh} />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col p-4">
          <Ledger
            intents={state.intents}
            selectedId={selected?.id ?? null}
            onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
          />
        </main>
        {selected && <IntentDetail key={selected.id} intent={selected} onClose={closeDetail} />}
      </div>
    </div>
  );
}
