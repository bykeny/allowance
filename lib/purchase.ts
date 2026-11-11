import { db } from "./db";
import { findItem } from "./catalog";
import { evaluate } from "./policy";
import { captureOrder, captureResult, createOrder, PayPalError } from "./paypal";

export interface PurchaseInput {
  item_id: string;
  justification: string;
}

/**
 * The only way the agent can spend money. Price, vendor and category come
 * from the catalog, never from the model, so it cannot understate an amount.
 */
export async function requestPurchase(input: PurchaseInput) {
  const item = findItem(input.item_id);
  if (!item) return { error: `Unknown item_id "${input.item_id}". Use search_catalog first.` };

  const previous = db.listIntents();
  const intent = db.insertIntent({
    itemId: item.id,
    itemName: item.name,
    vendor: item.vendor,
    category: item.category,
    amount: item.price,
    currency: item.currency,
    justification: input.justification,
    status: "REQUESTED",
  });

  const verdict = evaluate({ vendor: item.vendor, category: item.category, amount: item.price }, db.getPolicy(), db.spentToday(), previous);
  db.updateIntent(intent.id, verdict);

  if (verdict.decision === "DENY") {
    db.updateIntent(intent.id, { status: "DENIED" });
    return { intent_id: intent.id, ...verdict, status: "DENIED" };
  }

  // ALLOW needs a linked wallet to pay unattended. Without one, a human approves.
  const vaultId = verdict.decision === "ALLOW" ? db.getVaultId() : undefined;
  let reason = verdict.reason;
  if (verdict.decision === "ALLOW" && !vaultId) {
    reason = "Within policy, but no PayPal wallet is linked yet, so a human must approve";
    db.updateIntent(intent.id, { reason });
  }

  try {
    const order = await createOrder({
      intentId: intent.id,
      amount: item.price.toFixed(2),
      currency: item.currency,
      description: `${item.name} (${item.vendor})`,
      vaultId,
    });

    if (vaultId) {
      // Vaulted orders usually complete at create; otherwise capture. Only a COMPLETED capture counts as paid.
      const { captureId, captureStatus } =
        order.status === "COMPLETED" && order.captureId
          ? { captureId: order.captureId, captureStatus: order.captureStatus }
          : captureResult(await captureOrder(order.id));
      if (captureStatus !== "COMPLETED") {
        const error = `Vault payment not completed: order ${order.status}, capture ${captureStatus ?? "missing"}${
          captureStatus === "DECLINED" || captureStatus === "FAILED" ? " (the PayPal wallet's funding source was declined)" : ""
        }`;
        db.updateIntent(intent.id, { status: "FAILED", orderId: order.id, captureId, paidVia: "VAULT", error });
        return { intent_id: intent.id, decision: "ALLOW", reason, status: "FAILED", error };
      }
      db.updateIntent(intent.id, { status: "CAPTURED", orderId: order.id, captureId, paidVia: "VAULT" });
      return { intent_id: intent.id, decision: "ALLOW", reason, status: "CAPTURED", order_id: order.id };
    }

    db.updateIntent(intent.id, { status: "AWAITING_HUMAN", orderId: order.id, approveUrl: order.approveUrl });
    return {
      intent_id: intent.id,
      decision: verdict.decision,
      reason,
      status: "AWAITING_HUMAN",
      note: "A human has been shown an approval button in the dashboard. Do not retry.",
    };
  } catch (e) {
    const error =
      e instanceof PayPalError
        ? `${e.name}${e.issue ? ` / ${e.issue}` : ""} (debug_id ${e.debugId ?? "none"}): ${e.message}`
        : e instanceof Error
          ? e.message
          : String(e);
    db.updateIntent(intent.id, { status: "FAILED", error });
    return { intent_id: intent.id, ...verdict, status: "FAILED", error };
  }
}
