"use client";
import { useEffect, useState } from "react";
import type { Policy } from "@/lib/types";

interface CatalogMeta {
  vendors: string[];
  categories: string[];
}

export default function PolicyBar(props: {
  policy: Policy;
  spentToday: number;
  walletLinked: boolean;
  onChange: (patch: Partial<Policy>) => Promise<string | null>;
  onLinkWallet: () => void;
  onUnlinkWallet: () => void;
  onReset: () => void;
}) {
  const { policy, spentToday } = props;
  const [meta, setMeta] = useState<CatalogMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pct = policy.dailyBudget > 0 ? Math.min(100, (spentToday / policy.dailyBudget) * 100) : 100;

  useEffect(() => {
    let alive = true;
    fetch("/api/catalog/meta")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => alive && setMeta({ vendors: j.vendors ?? [], categories: j.categories ?? [] }))
      .catch((e) => alive && setError(`Could not load catalog vendors and categories (${e.message}).`));
    return () => {
      alive = false;
    };
  }, []);

  async function change(patch: Partial<Policy>) {
    setSaving(true);
    const err = await props.onChange(patch);
    setError(err);
    setSaving(false);
  }

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const addableVendors = meta?.vendors.filter((v) => !policy.vendorAllowlist.includes(v)) ?? [];
  const addableCategories = meta?.categories.filter((c) => !policy.blockedCategories.includes(c)) ?? [];

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-6 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <div className="text-lg font-semibold leading-none tracking-tight">Allowance</div>
            <div className="mt-1 text-xs text-stone-500">Spending rules for AI agents</div>
          </div>
        </div>

        <div className="min-w-56 flex-1">
          <div className="mb-1 flex justify-between text-xs text-stone-500">
            <span>Spent today</span>
            <span className="tabular-nums font-medium text-stone-900">
              ${spentToday.toFixed(2)} <span className="font-normal text-stone-400">of ${policy.dailyBudget.toFixed(2)}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {props.walletLinked ? (
            <button
              onClick={props.onUnlinkWallet}
              title="Unlink the wallet: in-policy purchases will need human approval again"
              className="group flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
              <span className="group-hover:hidden">PayPal wallet linked</span>
              <span className="hidden group-hover:inline">Unlink wallet</span>
            </button>
          ) : (
            <button
              onClick={props.onLinkWallet}
              title="Link a PayPal wallet so in-policy purchases pay without a human"
              className="flex items-center gap-2 rounded-lg bg-[#0070ba] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#005ea6]"
            >
              <span className="h-2 w-2 rounded-full bg-white/60" />
              Link PayPal wallet
            </button>
          )}
          <button onClick={props.onReset} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50">
            Reset demo
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 border-t border-stone-100 bg-stone-50/60 px-6 py-3">
        <div className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
          Policy
          <div className="mt-0.5 font-normal normal-case tracking-normal text-stone-400">{saving ? "Saving…" : "enforced in code"}</div>
        </div>

        <NumberField label="Auto-approve up to" value={policy.autoApproveLimit} onCommit={(v) => change({ autoApproveLimit: v })} />
        <NumberField label="Daily budget" value={policy.dailyBudget} onCommit={(v) => change({ dailyBudget: v })} />

        <ChipGroup
          label="Allowed vendors"
          tone="allow"
          values={policy.vendorAllowlist}
          addable={addableVendors}
          addLabel="+ vendor"
          empty="No vendors allowed"
          onRemove={(v) => change({ vendorAllowlist: toggle(policy.vendorAllowlist, v) })}
          onAdd={(v) => change({ vendorAllowlist: [...policy.vendorAllowlist, v] })}
        />
        <ChipGroup
          label="Blocked categories"
          tone="block"
          values={policy.blockedCategories}
          addable={addableCategories}
          addLabel="+ block"
          empty="Nothing blocked"
          onRemove={(c) => change({ blockedCategories: toggle(policy.blockedCategories, c) })}
          onAdd={(c) => change({ blockedCategories: [...policy.blockedCategories, c] })}
        />
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 border-t border-red-200 bg-red-50 px-6 py-2 text-sm text-red-800">
          <span>
            <span className="font-semibold">Policy not saved: </span>
            {error}
          </span>
          <button onClick={() => setError(null)} className="text-xs text-red-600 hover:underline">
            dismiss
          </button>
        </div>
      )}
    </header>
  );
}

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="8" fill="#1c1917" />
      <path d="M9 22 L16 9 L23 22" fill="none" stroke="#fafaf9" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.8 17.5 H20.2" stroke="#34d399" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function ChipGroup(props: {
  label: string;
  tone: "allow" | "block";
  values: string[];
  addable: string[];
  addLabel: string;
  empty: string;
  onRemove: (v: string) => void;
  onAdd: (v: string) => void;
}) {
  const chip =
    props.tone === "allow" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800";
  return (
    <div className="min-w-0 text-xs text-stone-500">
      <div>{props.label}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {props.values.length === 0 && <span className="py-0.5 italic text-stone-400">{props.empty}</span>}
        {props.values.map((v) => (
          <span key={v} className={`inline-flex items-center gap-1 rounded-md border py-0.5 pl-2 pr-1 font-medium ${chip}`}>
            {v}
            <button
              onClick={() => props.onRemove(v)}
              aria-label={`Remove ${v}`}
              className="rounded px-1 leading-none opacity-60 hover:bg-white/70 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        {props.addable.length > 0 && (
          <select
            value=""
            aria-label={`${props.addLabel} to ${props.label}`}
            onChange={(e) => e.target.value && props.onAdd(e.target.value)}
            className="cursor-pointer rounded-md border border-dashed border-stone-300 bg-white px-1.5 py-0.5 text-stone-600 outline-none hover:border-stone-500"
          >
            <option value="">{props.addLabel}</option>
            {props.addable.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function NumberField(props: { label: string; value: number; onCommit: (v: number) => void }) {
  return (
    <label className="text-xs text-stone-500">
      {props.label}
      <div className="mt-1 flex items-center rounded-md border border-stone-300 bg-white px-2 focus-within:border-stone-500">
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
          className="w-16 bg-transparent px-1 py-1 text-sm tabular-nums text-stone-900 outline-none"
        />
      </div>
    </label>
  );
}
