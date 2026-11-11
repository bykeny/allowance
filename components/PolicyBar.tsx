"use client";
import type { Policy } from "@/lib/types";

export default function PolicyBar(props: {
  policy: Policy;
  spentToday: number;
  walletLinked: boolean;
  onChange: (patch: Partial<Policy>) => void;
  onLinkWallet: () => void;
  onUnlinkWallet: () => void;
  onReset: () => void;
}) {
  const { policy, spentToday } = props;
  const pct = policy.dailyBudget > 0 ? Math.min(100, (spentToday / policy.dailyBudget) * 100) : 100;

  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3 border-b border-stone-200 bg-white px-6 py-4">
      <div>
        <div className="text-lg font-semibold tracking-tight">Allowance</div>
        <div className="text-xs text-stone-500">Spending rules for AI agents</div>
      </div>

      <NumberField
        label="Auto-approve up to"
        value={policy.autoApproveLimit}
        onCommit={(v) => props.onChange({ autoApproveLimit: v })}
      />
      <NumberField label="Daily budget" value={policy.dailyBudget} onCommit={(v) => props.onChange({ dailyBudget: v })} />

      <div className="min-w-48 flex-1">
        <div className="mb-1 flex justify-between text-xs text-stone-500">
          <span>Spent today</span>
          <span className="tabular-nums text-stone-800">
            ${spentToday.toFixed(2)} / ${policy.dailyBudget.toFixed(2)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="text-xs text-stone-500">
        <div>Blocked categories</div>
        <div className="mt-1 flex gap-1">
          {policy.blockedCategories.map((c) => (
            <span key={c} className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {props.walletLinked ? (
          <button
            onClick={props.onUnlinkWallet}
            title="Click to unlink"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800"
          >
            PayPal wallet linked
          </button>
        ) : (
          <button
            onClick={props.onLinkWallet}
            className="rounded-md bg-[#0070ba] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#005ea6]"
          >
            Link PayPal wallet
          </button>
        )}
        <button onClick={props.onReset} className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50">
          Reset demo
        </button>
      </div>
    </div>
  );
}

function NumberField(props: { label: string; value: number; onCommit: (v: number) => void }) {
  return (
    <label className="text-xs text-stone-500">
      {props.label}
      <div className="mt-1 flex items-center rounded-md border border-stone-300 bg-white px-2">
        <span className="text-stone-400">$</span>
        <input
          key={props.value}
          type="number"
          min={0}
          defaultValue={props.value}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v >= 0 && v !== props.value) props.onCommit(v);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-20 bg-transparent px-1 py-1.5 text-sm tabular-nums text-stone-900 outline-none"
        />
      </div>
    </label>
  );
}
