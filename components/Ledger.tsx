"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GetRowIdParams,
  type ICellRendererParams,
  type IRowNode,
  type ModelUpdatedEvent,
  type PostSortRowsParams,
  type RowClassRules,
  type RowDataUpdatedEvent,
} from "ag-grid-community";
import type { Intent } from "@/lib/types";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  fontSize: 13,
  headerFontSize: 12,
  spacing: 6,
  rowHeight: 44,
  headerBackgroundColor: "#faf9f6",
  borderColor: "#e7e5e4",
  accentColor: "#1c1917",
  wrapperBorderRadius: 12,
});

type GroupKey = "ALLOW" | "ESCALATE" | "DENY" | "PENDING";
const GROUP_ORDER: GroupKey[] = ["ALLOW", "ESCALATE", "DENY", "PENDING"];
const GROUP_LABEL: Record<GroupKey, string> = {
  ALLOW: "Allowed by policy",
  ESCALATE: "Escalated to a human",
  DENY: "Denied by policy",
  PENDING: "Awaiting a verdict",
};

interface Totals {
  shown: number;
  captured: number;
  capturedAmount: number;
  awaiting: number;
  awaitingAmount: number;
  denied: number;
  failed: number;
}

/** A ledger row: a real intent, a group header (grouped view) or the pinned totals row. */
type Row = Partial<Intent> & { id: string; __group?: GroupKey; __count?: number; __sum?: number; __totals?: Totals };

const groupOf = (r: Row): GroupKey => r.__group ?? (r.decision as GroupKey | undefined) ?? "PENDING";
const money = (n: number, currency = "USD") => `${currency} ${n.toFixed(2)}`;

/** Outcome tone of a status: what a viewer should read at a glance. */
type Tone = "ok" | "wait" | "bad" | "muted";
const TONE: Record<string, Tone> = {
  CAPTURED: "ok",
  AWAITING_HUMAN: "wait",
  REQUESTED: "wait",
  DENIED: "bad",
  FAILED: "bad",
  CANCELLED: "muted",
};

const TONE_PILL: Record<Tone, string> = {
  ok: "bg-emerald-600 text-white",
  wait: "bg-amber-400 text-amber-950",
  bad: "bg-red-600 text-white",
  muted: "bg-stone-300 text-stone-700",
};

const STATUS_LABEL: Record<string, string> = {
  CAPTURED: "✓ Paid",
  AWAITING_HUMAN: "Awaiting approval",
  REQUESTED: "Processing…",
  DENIED: "✕ Denied",
  FAILED: "✕ Failed",
  CANCELLED: "Cancelled",
};

const VERDICT_PILL: Record<string, string> = {
  ALLOW: "border-emerald-300 bg-emerald-50 text-emerald-800",
  ESCALATE: "border-amber-300 bg-amber-50 text-amber-800",
  DENY: "border-red-300 bg-red-50 text-red-800",
};

function VerdictCell({ value, data, node }: ICellRendererParams<Row>) {
  if (node.rowPinned || !value) return null;
  // Display only: the stored verdict stays ESCALATE; this just shows the human approved it.
  const approved = value === "ESCALATE" && data?.status === "CAPTURED" && data?.paidVia === "HUMAN_APPROVAL";
  return (
    <span className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide ${VERDICT_PILL[value] ?? ""}`}>
      {value}
      {approved && <span className="font-semibold"> → approved</span>}
    </span>
  );
}

function StatusCell({ data, node }: ICellRendererParams<Row>) {
  if (!data) return null;
  if (node.rowPinned && data.__totals) {
    const t = data.__totals;
    return (
      <span className="text-xs font-semibold text-stone-700">
        {t.awaiting > 0 ? `${t.awaiting} awaiting · ${money(t.awaitingAmount)}` : "Nothing awaiting"}
      </span>
    );
  }
  if (data.status === "AWAITING_HUMAN" && data.approveUrl)
    return (
      <a
        href={data.approveUrl}
        onClick={(e) => e.stopPropagation()}
        className="approve-btn inline-flex items-center gap-1.5 rounded-lg bg-[#0070ba] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#005ea6]"
      >
        Approve in PayPal <span aria-hidden>→</span>
      </a>
    );
  const s = data.status ?? "";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${TONE_PILL[TONE[s] ?? "muted"]}`}>
      {STATUS_LABEL[s] ?? s}
    </span>
  );
}

function AmountCell({ data, node, valueFormatted }: ICellRendererParams<Row>) {
  if (node.rowPinned && data?.__totals)
    return <span className="font-semibold tabular-nums text-emerald-800">{money(data.__totals.capturedAmount)} paid</span>;
  return <span className="tabular-nums">{valueFormatted}</span>;
}

function GroupHeader({ data }: ICellRendererParams<Row>) {
  if (!data?.__group) return null;
  const g = data.__group;
  const dot = g === "ALLOW" ? "bg-emerald-500" : g === "ESCALATE" ? "bg-amber-400" : g === "DENY" ? "bg-red-500" : "bg-stone-400";
  return (
    <div className="flex h-full items-center gap-3 px-4 text-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      <span className="font-semibold text-stone-900">{GROUP_LABEL[g]}</span>
      <span className="text-stone-500">
        {data.__count} request{data.__count === 1 ? "" : "s"} · {money(data.__sum ?? 0)}
      </span>
    </div>
  );
}

const rowClassRules: RowClassRules<Row> = {
  "ledger-row-ok": (p) => !p.node.rowPinned && TONE[p.data?.status ?? ""] === "ok",
  "ledger-row-wait": (p) => !p.node.rowPinned && TONE[p.data?.status ?? ""] === "wait",
  "ledger-row-bad": (p) => !p.node.rowPinned && TONE[p.data?.status ?? ""] === "bad",
  "ledger-row-muted": (p) => !p.node.rowPinned && TONE[p.data?.status ?? ""] === "muted",
  "ledger-row-group": (p) => !!p.data?.__group,
  "ledger-row-totals": (p) => p.node.rowPinned === "bottom",
};

export default function Ledger({
  intents,
  selectedId,
  onSelect,
}: {
  intents: Intent[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const grid = useRef<AgGridReact<Row>>(null);
  const seen = useRef<Set<string> | null>(null);
  const [grouped, setGrouped] = useState(false);
  const [search, setSearch] = useState("");
  const [totals, setTotals] = useState<Totals | null>(null);

  // Row classes are computed at render time, so redraw when the selection changes.
  useEffect(() => {
    grid.current?.api?.redrawRows();
  }, [selectedId]);

  const cols = useMemo<ColDef<Row>[]>(
    () => [
      {
        headerName: "Outcome",
        field: "status",
        width: 190,
        pinned: "left",
        cellRenderer: StatusCell,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Time",
        field: "createdAt",
        width: 100,
        sort: "desc",
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""),
      },
      {
        headerName: "Item",
        field: "itemName",
        flex: 2,
        minWidth: 200,
        cellClass: "font-medium",
        valueFormatter: (p) => (p.node?.rowPinned && p.data?.__totals ? `${p.data.__totals.shown} requests shown` : (p.value ?? "")),
      },
      {
        headerName: "Amount",
        field: "amount",
        width: 140,
        type: "rightAligned",
        filter: "agNumberColumnFilter",
        cellRenderer: AmountCell,
        valueFormatter: (p) => (typeof p.value === "number" ? money(p.value, p.data?.currency) : ""),
      },
      { headerName: "Verdict", field: "decision", width: 160, cellRenderer: VerdictCell },
      { headerName: "Policy reason", field: "reason", flex: 3, minWidth: 220, tooltipField: "reason" },
      { headerName: "Agent's justification", field: "justification", flex: 3, minWidth: 220, tooltipField: "justification" },
      { headerName: "Vendor", field: "vendor", width: 125 },
      { headerName: "Category", field: "category", width: 115 },
      {
        headerName: "Paid via",
        field: "paidVia",
        width: 140,
        valueFormatter: (p) => (p.value === "VAULT" ? "Linked wallet" : p.value === "HUMAN_APPROVAL" ? "Human approval" : ""),
      },
      { headerName: "PayPal order", field: "orderId", width: 180, cellClass: "font-mono text-xs" },
      { headerName: "PayPal capture", field: "captureId", width: 180, cellClass: "font-mono text-xs" },
      { headerName: "Error", field: "error", width: 220, tooltipField: "error", cellClass: "text-red-700" },
    ],
    []
  );

  // In grouped view, insert one header row per verdict; postSortRows keeps each header above its members.
  const rowData = useMemo<Row[]>(() => {
    if (!grouped) return intents;
    const headers = GROUP_ORDER.flatMap((g) => {
      const members = intents.filter((i) => groupOf(i) === g);
      if (members.length === 0) return [];
      return [{ id: `__group-${g}`, __group: g, __count: members.length, __sum: members.reduce((s, i) => s + i.amount, 0) } as Row];
    });
    return [...headers, ...intents];
  }, [intents, grouped]);

  const postSortRows = useCallback(
    (p: PostSortRowsParams<Row>) => {
      if (!grouped) return;
      const ordered: IRowNode<Row>[] = [];
      for (const g of GROUP_ORDER) {
        const inGroup = p.nodes.filter((n) => n.data && groupOf(n.data) === g);
        const header = inGroup.filter((n) => n.data?.__group);
        ordered.push(...header, ...inGroup.filter((n) => !n.data?.__group));
      }
      p.nodes.splice(0, p.nodes.length, ...ordered);
    },
    [grouped]
  );

  // Totals follow whatever the filters currently show.
  const onModelUpdated = useCallback((e: ModelUpdatedEvent<Row>) => {
    const t: Totals = { shown: 0, captured: 0, capturedAmount: 0, awaiting: 0, awaitingAmount: 0, denied: 0, failed: 0 };
    e.api.forEachNodeAfterFilterAndSort((n) => {
      const d = n.data;
      if (!d || d.__group) return;
      t.shown++;
      if (d.status === "CAPTURED") {
        t.captured++;
        t.capturedAmount += d.amount ?? 0;
      }
      if (d.status === "AWAITING_HUMAN") {
        t.awaiting++;
        t.awaitingAmount += d.amount ?? 0;
      }
      if (d.status === "DENIED") t.denied++;
      if (d.status === "FAILED") t.failed++;
    });
    setTotals((prev) => (JSON.stringify(prev) === JSON.stringify(t) ? prev : t));
  }, []);

  // Flash rows that are new since the last poll (changed cells flash via enableCellChangeFlash).
  const onRowDataUpdated = useCallback((e: RowDataUpdatedEvent<Row>) => {
    const ids = new Set<string>();
    const fresh: IRowNode<Row>[] = [];
    e.api.forEachNode((n) => {
      if (!n.data || n.data.__group) return;
      ids.add(n.data.id);
      if (seen.current && !seen.current.has(n.data.id)) fresh.push(n);
    });
    seen.current = ids;
    if (fresh.length) e.api.flashCells({ rowNodes: fresh, flashDuration: 1200, fadeDuration: 800 });
  }, []);

  // The id changes with the content so AG Grid re-renders the pinned cells (their field values never change).
  const pinned = useMemo<Row[]>(
    () => (totals && totals.shown > 0 ? [{ id: `__totals-${Object.values(totals).join("-")}`, __totals: totals }] : []),
    [totals]
  );

  function exportCsv() {
    grid.current?.api.exportDataAsCsv({
      fileName: `allowance-audit-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`,
      skipPinnedBottom: true,
      shouldRowBeSkipped: (p) => !!p.node.data?.__group,
      processCellCallback: (p) => {
        const field = p.column.getColDef().field;
        if (field === "createdAt" || field === "amount" || field === "status") return p.value == null ? "" : String(p.value);
        return p.formatValue(p.value);
      },
    });
  }

  const counts = useMemo(() => {
    const c = { ok: 0, wait: 0, bad: 0 };
    for (const i of intents) {
      const t = TONE[i.status];
      if (t === "ok" || t === "wait" || t === "bad") c[t]++;
    }
    return c;
  }, [intents]);

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold text-stone-900">Audit ledger</h2>
          <div className="flex gap-2 text-xs">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">{counts.ok} paid</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">{counts.wait} awaiting</span>
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">{counts.bad} blocked</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ledger…"
            className="w-44 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-stone-500"
          />
          <button
            onClick={() => setGrouped((g) => !g)}
            aria-pressed={grouped}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              grouped ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"
            }`}
          >
            Group by verdict
          </button>
          <button
            onClick={exportCsv}
            disabled={intents.length === 0}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-500 disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <AgGridReact<Row>
          ref={grid}
          theme={theme}
          rowData={rowData}
          columnDefs={cols}
          getRowId={(p: GetRowIdParams<Row>) => p.data.id}
          defaultColDef={{ sortable: true, resizable: true, filter: true, enableCellChangeFlash: true }}
          rowClassRules={rowClassRules}
          isFullWidthRow={(p) => !!p.rowNode.data?.__group}
          fullWidthCellRenderer={GroupHeader}
          postSortRows={postSortRows}
          pinnedBottomRowData={pinned}
          quickFilterText={search}
          onModelUpdated={onModelUpdated}
          onRowDataUpdated={onRowDataUpdated}
          onRowClicked={(e) => {
            if (e.data && !e.data.__group && !e.node.rowPinned) onSelect?.(e.data.id);
          }}
          getRowClass={(p) => (p.data && p.data.id === selectedId ? "ledger-row-selected" : undefined)}
          tooltipShowDelay={300}
          overlayNoRowsTemplate="No purchases yet. Ask the agent to buy something."
        />
      </div>
    </div>
  );
}
