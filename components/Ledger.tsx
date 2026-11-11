"use client";
import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams } from "ag-grid-community";
import type { Intent } from "@/lib/types";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({ fontSize: 13, headerFontSize: 12, spacing: 6 });

const PILL: Record<string, string> = {
  CAPTURED: "bg-emerald-100 text-emerald-800",
  AWAITING_HUMAN: "bg-amber-100 text-amber-800",
  DENIED: "bg-red-100 text-red-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-stone-200 text-stone-700",
  REQUESTED: "bg-stone-100 text-stone-600",
  ALLOW: "bg-emerald-50 text-emerald-700",
  ESCALATE: "bg-amber-50 text-amber-700",
  DENY: "bg-red-50 text-red-700",
};

const Pill = ({ value }: { value?: string }) =>
  value ? (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PILL[value] ?? ""}`}>{value.replace("_", " ")}</span>
  ) : null;

function StatusCell({ data }: ICellRendererParams<Intent>) {
  if (!data) return null;
  if (data.status === "AWAITING_HUMAN" && data.approveUrl)
    return (
      <a
        href={data.approveUrl}
        className="rounded-md bg-[#0070ba] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#005ea6]"
      >
        Approve in PayPal
      </a>
    );
  return <Pill value={data.status} />;
}

export default function Ledger({ intents }: { intents: Intent[] }) {
  const cols = useMemo<ColDef<Intent>[]>(
    () => [
      { headerName: "Time", field: "createdAt", width: 95, valueFormatter: (p) => new Date(p.value).toLocaleTimeString() },
      { headerName: "Item", field: "itemName", flex: 2, minWidth: 160 },
      { headerName: "Vendor", field: "vendor", width: 120 },
      {
        headerName: "Amount",
        field: "amount",
        width: 100,
        type: "rightAligned",
        valueFormatter: (p) => `${p.data?.currency ?? ""} ${Number(p.value).toFixed(2)}`,
      },
      { headerName: "Policy", field: "decision", width: 105, cellRenderer: (p: ICellRendererParams<Intent>) => <Pill value={p.value} /> },
      { headerName: "Status", field: "status", width: 160, cellRenderer: StatusCell },
      { headerName: "Policy reason", field: "reason", flex: 3, minWidth: 200, tooltipField: "reason" },
      { headerName: "Agent's justification", field: "justification", flex: 3, minWidth: 200, tooltipField: "justification" },
      { headerName: "Paid via", field: "paidVia", width: 130, valueFormatter: (p) => (p.value ? String(p.value).replace("_", " ") : "") },
      { headerName: "PayPal order", field: "orderId", width: 170, cellClass: "font-mono text-xs" },
      { headerName: "PayPal capture", field: "captureId", width: 170, cellClass: "font-mono text-xs" },
      { headerName: "Error", field: "error", width: 200, tooltipField: "error" },
    ],
    []
  );

  return (
    <div className="h-full w-full">
      <AgGridReact<Intent>
        theme={theme}
        rowData={intents}
        columnDefs={cols}
        getRowId={(p) => p.data.id}
        defaultColDef={{ sortable: true, resizable: true, filter: true, enableCellChangeFlash: true }}
        tooltipShowDelay={300}
        overlayNoRowsTemplate="No purchases yet. Ask the agent to buy something."
      />
    </div>
  );
}
