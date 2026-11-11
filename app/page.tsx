"use client";
import { useCallback, useEffect, useState } from "react";
import Chat from "@/components/Chat";
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

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/ledger", { cache: "no-store" });
      if (r.ok) setState(await r.json());
    } catch {
      /* keep last state; next poll retries */
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

  async function changePolicy(patch: Partial<Policy>) {
    await fetch("/api/policy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    refresh();
  }

  async function linkWallet() {
    const r = await fetch("/api/vault/setup", { method: "POST" });
    const j = await r.json();
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
    refresh();
  }

  if (!state) return <div className="p-8 text-sm text-stone-500">Loading…</div>;

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
      {notice && (
        <button onClick={() => setNotice(null)} className="border-b border-sky-200 bg-sky-50 px-6 py-2 text-left text-sm text-sky-900">
          {notice}
        </button>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="w-[380px] shrink-0 border-r border-stone-200">
          <Chat key={resetKey} onActivity={refresh} />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Audit ledger</div>
          <div className="min-h-0 flex-1">
            <Ledger intents={state.intents} />
          </div>
        </main>
      </div>
    </div>
  );
}
