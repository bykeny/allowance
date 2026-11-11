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

  describe("daily budget", () => {
    it("allows purchases when spentToday + amount is exactly at the daily budget", () => {
      // Limit is 25, spent is 75, amount is 25 => total 100 <= 100
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 25 }, defaultPolicy, 75, []);
      expect(res.decision).toBe("ALLOW");
      expect(res.reason).toBe("Within policy");
    });

    it("escalates purchases when spentToday + amount exceeds the daily budget", () => {
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 20 }, defaultPolicy, 85, []);
      expect(res.decision).toBe("ESCALATE");
      expect(res.reason).toBe("Would exceed the daily budget (85.00 spent of 100.00)");
    });
  });

  describe("duplicate detection", () => {
    const now = 1700000000000;

    it("escalates if identical vendor and amount were CAPTURED within 10 minutes", () => {
      const previous = [
        createPreviousIntent({
          vendor: "DomainHut",
          amount: 12,
          status: "CAPTURED",
          createdAt: new Date(now - 5 * 60_000).toISOString(),
        }),
      ];
      const res = evaluate({ vendor: "DomainHut", category: "domains", amount: 12 }, defaultPolicy, 0, previous, now);
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
