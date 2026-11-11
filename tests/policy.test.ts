import { describe, expect, it } from "vitest";
import { evaluate } from "../lib/policy";
import type { Intent, Policy } from "../lib/types";

describe("evaluate spend policy", () => {
  const defaultPolicy: Policy = {
    autoApproveLimit: 25,
    dailyBudget: 100,
    vendorAllowlist: ["DomainHut", "CloudBox", "MetricFlow", "PixelMart"],
    blockedCategories: ["gift_cards"],
  };

  const createPreviousIntent = (overrides: Partial<Intent> = {}): Intent => ({
    id: "prev-1",
    createdAt: new Date().toISOString(),
    itemId: "dom-com-1y",
    itemName: ".com domain",
    vendor: "DomainHut",
    category: "domains",
    amount: 12,
    currency: "USD",
    justification: "test purchase",
    status: "CAPTURED",
    ...overrides,
  });

  describe("amount validation", () => {
    it("denies zero amount", () => {
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 0 }, defaultPolicy, 0, []);
      expect(res.decision).toBe("DENY");
      expect(res.reason).toBe("Amount must be positive");
    });

    it("denies negative amount", () => {
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: -10 }, defaultPolicy, 0, []);
      expect(res.decision).toBe("DENY");
      expect(res.reason).toBe("Amount must be positive");
    });
  });

  describe("vendor allowlist", () => {
    it("denies vendors not on the allowlist", () => {
      const res = evaluate({ vendor: "UnknownVendor", category: "domains", amount: 12 }, defaultPolicy, 0, []);
      expect(res.decision).toBe("DENY");
      expect(res.reason).toBe('Vendor "UnknownVendor" is not on the allowlist');
    });

    it("allows vendors on the allowlist", () => {
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 12 }, defaultPolicy, 0, []);
      expect(res.decision).toBe("ALLOW");
      expect(res.reason).toBe("Within policy");
    });
  });

  describe("blocked categories", () => {
    it("denies items in blocked categories even if vendor is allowlisted", () => {
      const policyWithGiftCards: Policy = {
        ...defaultPolicy,
        vendorAllowlist: [...defaultPolicy.vendorAllowlist, "GiftCardCity"],
        blockedCategories: ["gift_cards"],
      };
      const res = evaluate({ vendor: "GiftCardCity", category: "gift_cards", amount: 15 }, policyWithGiftCards, 0, []);
      expect(res.decision).toBe("DENY");
      expect(res.reason).toBe('Category "gift_cards" is blocked');
    });
  });

  describe("auto-approve limit", () => {
    it("allows purchases strictly below the auto-approve limit", () => {
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 20 }, defaultPolicy, 0, []);
      expect(res.decision).toBe("ALLOW");
      expect(res.reason).toBe("Within policy");
    });

    it("allows purchases exactly at the auto-approve limit", () => {
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 25 }, defaultPolicy, 0, []);
      expect(res.decision).toBe("ALLOW");
      expect(res.reason).toBe("Within policy");
    });

    it("escalates purchases exceeding the auto-approve limit", () => {
      const res = evaluate({ vendor: "CloudBox", category: "hosting", amount: 25.01 }, defaultPolicy, 0, []);
      expect(res.decision).toBe("ESCALATE");
      expect(res.reason).toBe("Above the auto-approve limit of 25.00");
    });
  });

  describe("daily budget and reservation", () => {
    const now = 1700000000000;

    it("allows purchases when spentToday + amount is exactly at the daily budget", () => {
      // Limit is 25, spent is 75, amount is 25 => total 100 <= 100
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 25 }, defaultPolicy, 75, [], now);
      expect(res.decision).toBe("ALLOW");
      expect(res.reason).toBe("Within policy");
    });

    it("escalates purchases when spentToday + amount exceeds the daily budget", () => {
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 20 }, defaultPolicy, 85, [], now);
      expect(res.decision).toBe("ESCALATE");
      expect(res.reason).toBe("Would exceed the daily budget (85.00 spent of 100.00)");
    });

    it("counts AWAITING_HUMAN intents against the daily budget and reports both numbers", () => {
      const previous = [
        createPreviousIntent({
          id: "pending-1",
          amount: 80,
          status: "AWAITING_HUMAN",
          createdAt: new Date(now - 1000).toISOString(),
        }),
      ];
      // spentToday: 45, pending: 80, req: 12 => 45 + 80 + 12 = 137 > 100
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 12 }, defaultPolicy, 45, previous, now);
      expect(res.decision).toBe("ESCALATE");
      expect(res.reason).toBe("Would exceed the daily budget (45.00 captured + 80.00 pending of 100.00)");
    });

    it("releases reservation when an intent is CANCELLED or FAILED", () => {
      const previous = [
        createPreviousIntent({
          id: "cancelled-1",
          amount: 80,
          status: "CANCELLED",
          createdAt: new Date(now - 1000).toISOString(),
        }),
        createPreviousIntent({
          id: "failed-1",
          amount: 80,
          status: "FAILED",
          createdAt: new Date(now - 2000).toISOString(),
        }),
      ];
      // spentToday: 10, pending: 0, req: 12 => 22 <= 100
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 12 }, defaultPolicy, 10, previous, now);
      expect(res.decision).toBe("ALLOW");
      expect(res.reason).toBe("Within policy");
    });

    it("two pending $80 requests mean a third purchase escalates for budget", () => {
      const previous = [
        createPreviousIntent({
          id: "pending-1",
          itemId: "analytics-growth",
          amount: 80,
          status: "AWAITING_HUMAN",
          createdAt: new Date(now - 1000).toISOString(),
        }),
        createPreviousIntent({
          id: "pending-2",
          itemId: "host-pro",
          amount: 80,
          status: "AWAITING_HUMAN",
          createdAt: new Date(now - 2000).toISOString(),
        }),
      ];
      // Even a small $12 purchase that is otherwise within the $25 auto-approve limit escalates
      const res = evaluate({ itemId: "dom-com-1y", vendor: "DomainHut", category: "domains", amount: 12 }, defaultPolicy, 0, previous, now);
      expect(res.decision).toBe("ESCALATE");
      expect(res.reason).toBe("Would exceed the daily budget (0.00 captured + 160.00 pending of 100.00)");
    });
  });

  describe("duplicate detection", () => {
    const now = 1700000000000;

    it("escalates if identical itemId was CAPTURED within 10 minutes", () => {
      const previous = [
        createPreviousIntent({
          itemId: "dom-com-1y",
          vendor: "DomainHut",
          amount: 12,
          status: "CAPTURED",
          createdAt: new Date(now - 3 * 60_000).toISOString(),
        }),
      ];
      const res = evaluate({ itemId: "dom-com-1y", vendor: "DomainHut", category: "domains", amount: 12 }, defaultPolicy, 0, previous, now);
      expect(res.decision).toBe("ESCALATE");
      expect(res.reason).toBe("Possible duplicate of a purchase in the last 10 minutes");
    });

    it("escalates if identical itemId is AWAITING_HUMAN within 10 minutes even if amount differs", () => {
      const previous = [
        createPreviousIntent({
          itemId: "analytics-growth",
          vendor: "MetricFlow",
          amount: 80,
          status: "AWAITING_HUMAN",
          createdAt: new Date(now - 3 * 60_000).toISOString(),
        }),
      ];
      const res = evaluate({ itemId: "analytics-growth", vendor: "MetricFlow", category: "software", amount: 75 }, defaultPolicy, 0, previous, now);
      expect(res.decision).toBe("ESCALATE");
      expect(res.reason).toBe("Possible duplicate of a purchase in the last 10 minutes");
    });

    it("escalates if identical vendor and amount are AWAITING_HUMAN within 10 minutes", () => {
      const previous = [
        createPreviousIntent({
          vendor: "DomainHut",
          amount: 12,
          status: "AWAITING_HUMAN",
          createdAt: new Date(now - 2 * 60_000).toISOString(),
        }),
      ];
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 12 }, defaultPolicy, 0, previous, now);
      expect(res.decision).toBe("ESCALATE");
      expect(res.reason).toBe("Possible duplicate of a purchase in the last 10 minutes");
    });

    it("does not escalate for duplicate older than 10 minutes", () => {
      const previous = [
        createPreviousIntent({
          vendor: "DomainHut",
          amount: 12,
          status: "CAPTURED",
          createdAt: new Date(now - 11 * 60_000).toISOString(),
        }),
      ];
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 12 }, defaultPolicy, 0, previous, now);
      expect(res.decision).toBe("ALLOW");
      expect(res.reason).toBe("Within policy");
    });

    it("does not escalate for duplicate of a DENIED intent", () => {
      const previous = [
        createPreviousIntent({
          vendor: "DomainHut",
          amount: 12,
          status: "DENIED",
          createdAt: new Date(now - 2 * 60_000).toISOString(),
        }),
      ];
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 12 }, defaultPolicy, 0, previous, now);
      expect(res.decision).toBe("ALLOW");
      expect(res.reason).toBe("Within policy");
    });

    it("does not escalate for duplicate of a CANCELLED or FAILED intent", () => {
      const previous = [
        createPreviousIntent({
          vendor: "DomainHut",
          amount: 12,
          status: "CANCELLED",
          createdAt: new Date(now - 2 * 60_000).toISOString(),
        }),
        createPreviousIntent({
          vendor: "DomainHut",
          amount: 12,
          status: "FAILED",
          createdAt: new Date(now - 3 * 60_000).toISOString(),
        }),
      ];
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 12 }, defaultPolicy, 0, previous, now);
      expect(res.decision).toBe("ALLOW");
      expect(res.reason).toBe("Within policy");
    });

    it("does not escalate when vendor or amount differ", () => {
      const previous = [
        createPreviousIntent({
          vendor: "CloudBox",
          amount: 12,
          status: "CAPTURED",
          createdAt: new Date(now - 2 * 60_000).toISOString(),
        }),
        createPreviousIntent({
          vendor: "DomainHut",
          amount: 15,
          status: "CAPTURED",
          createdAt: new Date(now - 2 * 60_000).toISOString(),
        }),
      ];
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 12 }, defaultPolicy, 0, previous, now);
      expect(res.decision).toBe("ALLOW");
      expect(res.reason).toBe("Within policy");
    });
  });
});
