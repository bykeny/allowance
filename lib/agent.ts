import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { searchCatalog } from "./catalog";
import { requestPurchase, type PurchaseInput } from "./purchase";

const SYSTEM = `You are a procurement agent with a PayPal-backed allowance.
- Use search_catalog to find items; only buy items from the catalog, by item_id.
- Check get_budget_status before your first purchase in a conversation.
- Buy only what the user's task needs, one request_purchase per item.
- A policy engine you cannot see or override returns ALLOW, ESCALATE or DENY.
  Never split, re-word or retry a purchase to get around a verdict.
- After acting, tell the user in 1-3 short sentences what happened to each
  purchase and why, quoting the policy reason.`;

const tools: Anthropic.Tool[] = [
  {
    name: "search_catalog",
    description: "Search the vendor catalog. Returns items with id, vendor, category and price.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "get_budget_status",
    description: "Current spend policy and how much of today's budget is left.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "request_purchase",
    description:
      "Request to buy one catalog item. The policy engine decides: ALLOW (paid immediately from the linked PayPal wallet), ESCALATE (a human must approve in PayPal), or DENY.",
    input_schema: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "Catalog item id" },
        justification: { type: "string", description: "Why this purchase serves the user's goal" },
      },
      required: ["item_id", "justification"],
    },
  },
  {
    name: "check_purchase_status",
    description: "Look up the current status of an earlier purchase intent.",
    input_schema: { type: "object", properties: { intent_id: { type: "string" } }, required: ["intent_id"] },
  },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
const handlers: Record<string, (input: any) => unknown | Promise<unknown>> = {
  search_catalog: ({ query }: { query: string }) => searchCatalog(query ?? ""),
  get_budget_status: () => {
    const p = db.getPolicy();
    const spent = db.spentToday();
    return { ...p, spentToday: spent, remainingToday: Math.max(0, p.dailyBudget - spent), walletLinked: !!db.getVaultId() };
  },
  request_purchase: (input: PurchaseInput) => requestPurchase(input),
  check_purchase_status: ({ intent_id }: { intent_id: string }) => {
    const i = db.getIntent(intent_id);
    return i ? { intent_id: i.id, status: i.status, decision: i.decision, reason: i.reason } : { error: "Not found" };
  },
};

export interface ToolTrace {
  name: string;
  input: unknown;
  output: unknown;
}

// One shared conversation is enough for a single-user demo.
const g = globalThis as unknown as { __allowanceChat?: Anthropic.MessageParam[] };
export const resetChat = () => {
  g.__allowanceChat = [];
};

export async function runAgent(userText: string): Promise<{ reply: string; trace: ToolTrace[] }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const anthropic = new Anthropic();
  const messages = (g.__allowanceChat ??= []);
  const checkpoint = messages.length;
  messages.push({ role: "user", content: userText });
  const trace: ToolTrace[] = [];

  try {
    for (let round = 0; round < 8; round++) {
      const res = await anthropic.messages.create({
        model: process.env.MODEL ?? "claude-sonnet-5-5",
        max_tokens: 1024,
        system: SYSTEM,
        tools,
        messages,
      });
      messages.push({ role: "assistant", content: res.content });

      if (res.stop_reason !== "tool_use") {
        const reply = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
        return { reply, trace };
      }

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const b of res.content) {
        if (b.type !== "tool_use") continue;
        let output: unknown;
        try {
          const h = handlers[b.name];
          output = h ? await h(b.input) : { error: `Unknown tool ${b.name}` };
        } catch (e) {
          output = { error: e instanceof Error ? e.message : String(e) };
        }
        trace.push({ name: b.name, input: b.input, output });
        results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(output) });
      }
      messages.push({ role: "user", content: results });
    }
    return { reply: "I stopped after too many tool calls. Check the ledger for what happened.", trace };
  } catch (e) {
    messages.length = checkpoint; // keep history valid for the next turn
    throw e;
  }
}
