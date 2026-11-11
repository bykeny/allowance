import type { Decision, Intent, Policy } from "./types";

export interface Verdict {
  decision: Decision;
  reason: string;
}

/**
 * Deterministic spend policy. The LLM cannot see or change this code path:
 * it can only submit a request and read the verdict.
 */
export function evaluate(
  req: { vendor: string; category: string; amount: number; itemId?: string },
  p: Policy,
  spentToday: number,
  previous: Intent[],
  now = Date.now(),
  pendingToday?: number
): Verdict {
  if (!(req.amount > 0)) return { decision: "DENY", reason: "Amount must be positive" };
  if (!p.vendorAllowlist.includes(req.vendor))
    return { decision: "DENY", reason: `Vendor "${req.vendor}" is not on the allowlist` };
  if (p.blockedCategories.includes(req.category))
    return { decision: "DENY", reason: `Category "${req.category}" is blocked` };

  const dup = previous.some((i) => {
    const isSame = (req.itemId && i.itemId === req.itemId) || (i.vendor === req.vendor && i.amount === req.amount);
    return (
      isSame &&
      (i.status === "CAPTURED" || i.status === "AWAITING_HUMAN") &&
      now - Date.parse(i.createdAt) < 10 * 60_000
    );
  });
  if (dup) return { decision: "ESCALATE", reason: "Possible duplicate of a purchase in the last 10 minutes" };

  const today = new Date(now).toISOString().slice(0, 10);
  const pending =
    pendingToday ??
    previous
      .filter((i) => i.status === "AWAITING_HUMAN" && i.createdAt.startsWith(today))
      .reduce((s, i) => s + i.amount, 0);

  if (spentToday + pending + req.amount > p.dailyBudget) {
    const detail =
      pending > 0
        ? `${spentToday.toFixed(2)} captured + ${pending.toFixed(2)} pending of ${p.dailyBudget.toFixed(2)}`
        : `${spentToday.toFixed(2)} spent of ${p.dailyBudget.toFixed(2)}`;
    return {
      decision: "ESCALATE",
      reason: `Would exceed the daily budget (${detail})`,
    };
  }
  if (req.amount > p.autoApproveLimit)
    return { decision: "ESCALATE", reason: `Above the auto-approve limit of ${p.autoApproveLimit.toFixed(2)}` };

  return { decision: "ALLOW", reason: "Within policy" };
}
