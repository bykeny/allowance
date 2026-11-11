import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getCatalogMetaRoute } from "../app/api/catalog/meta/route";
import { GET as getPolicyRoute, PUT as putPolicyRoute } from "../app/api/policy/route";
import { db } from "../lib/db";
import { evaluate } from "../lib/policy";

describe("Policy API and Catalog Meta (Task 2.5)", () => {
  beforeEach(() => {
    db.reset();
  });

  afterEach(() => {
    db.reset();
  });

  it("GET /api/policy returns current policy", async () => {
    const res = await getPolicyRoute();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.autoApproveLimit).toBe(25);
    expect(data.dailyBudget).toBe(100);
  });

  it("GET /api/catalog/meta returns items, unique vendors, and unique categories", async () => {
    const res = await getCatalogMetaRoute();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data.items)).toBe(true);
    expect(Array.isArray(data.vendors)).toBe(true);
    expect(Array.isArray(data.categories)).toBe(true);

    expect(data.vendors).toContain("DomainHut");
    expect(data.vendors).toContain("CloudBox");
    expect(data.categories).toContain("domains");
    expect(data.categories).toContain("gift_cards");
  });

  it("PUT /api/policy rejects unknown vendors with 400", async () => {
    const req = new Request("http://localhost:3000/api/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorAllowlist: ["DomainHut", "BogusVendor"] }),
    });

    const res = await putPolicyRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Unknown vendor(s): BogusVendor");
  });

  it("PUT /api/policy rejects unknown categories with 400", async () => {
    const req = new Request("http://localhost:3000/api/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedCategories: ["illegal_items"] }),
    });

    const res = await putPolicyRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Unknown category(ies): illegal_items");
  });

  it("PUT /api/policy accepts valid edits and changes the next policy verdict", async () => {
    // Initially domains is not blocked
    const initialPolicy = db.getPolicy();
    expect(evaluate({ vendor: "DomainHut", category: "domains", amount: 12 }, initialPolicy, 0, []).decision).toBe("ALLOW");

    // Block domains category
    const req = new Request("http://localhost:3000/api/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedCategories: ["domains", "gift_cards"] }),
    });

    const res = await putPolicyRoute(req);
    expect(res.status).toBe(200);
    const updatedPolicy = await res.json();
    expect(updatedPolicy.blockedCategories).toEqual(["domains", "gift_cards"]);

    // Subsequent evaluation for domains must now be DENIED
    const verdict = evaluate({ vendor: "DomainHut", category: "domains", amount: 12 }, db.getPolicy(), 0, []);
    expect(verdict.decision).toBe("DENY");
    expect(verdict.reason).toBe('Category "domains" is blocked');
  });

  it("db.reset() restores default policy and empty ledger, but preserves linked wallet", () => {
    // Setup modified policy, some intents, and a linked wallet
    db.setPolicy({ autoApproveLimit: 50 });
    db.insertIntent({
      itemId: "dom-com-1y",
      itemName: ".com domain",
      vendor: "DomainHut",
      category: "domains",
      amount: 12,
      currency: "USD",
      justification: "test",
      status: "CAPTURED",
    });
    db.setVaultId("vault_token_abc_123");

    expect(db.getPolicy().autoApproveLimit).toBe(50);
    expect(db.listIntents().length).toBe(1);
    expect(db.getVaultId()).toBe("vault_token_abc_123");

    // Reset demo
    db.reset();

    expect(db.getPolicy().autoApproveLimit).toBe(25);
    expect(db.listIntents().length).toBe(0);
    expect(db.getVaultId()).toBe("vault_token_abc_123"); // wallet is preserved
  });
});
