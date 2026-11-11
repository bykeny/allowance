import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "../app/api/dev/purchase/route";
import { db } from "../lib/db";

describe("POST /api/dev/purchase", () => {
  const originalEnv = process.env.ALLOW_DEV_ROUTES;

  beforeEach(() => {
    db.setVaultId(undefined);
    db.reset();
  });

  afterEach(() => {
    process.env.ALLOW_DEV_ROUTES = originalEnv;
    db.setVaultId(undefined);
    db.reset();
  });

  it("returns 404 when ALLOW_DEV_ROUTES is not '1'", async () => {
    delete process.env.ALLOW_DEV_ROUTES;
    const req = new Request("http://localhost:3000/api/dev/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: "giftcard-40" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when item_id is missing", async () => {
    process.env.ALLOW_DEV_ROUTES = "1";
    const req = new Request("http://localhost:3000/api/dev/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ justification: "no item id provided" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("item_id is required");
  });

  it("processes DENY verdict correctly without calling PayPal", async () => {
    process.env.ALLOW_DEV_ROUTES = "1";
    const req = new Request("http://localhost:3000/api/dev/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: "giftcard-40", justification: "Raffle gift card" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.decision).toBe("DENY");
    expect(body.status).toBe("DENIED");
    expect(body.reason).toContain('Category "gift_cards" is blocked');

    // Check ledger
    const intents = db.listIntents();
    expect(intents.length).toBe(1);
    expect(intents[0].itemId).toBe("giftcard-40");
    expect(intents[0].amount).toBe(40);
    expect(intents[0].vendor).toBe("GiftCardCity");
    expect(intents[0].category).toBe("gift_cards");
    expect(intents[0].decision).toBe("DENY");
    expect(intents[0].status).toBe("DENIED");
    expect(intents[0].orderId).toBeUndefined();
  });

  it("processes ESCALATE verdict (analytics-growth: $80 exceeds auto-approve limit)", async () => {
    process.env.ALLOW_DEV_ROUTES = "1";
    const req = new Request("http://localhost:3000/api/dev/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: "analytics-growth", justification: "Analytics for launch" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.decision).toBe("ESCALATE");
    expect(body.reason).toContain("Above the auto-approve limit of 25.00");

    const intents = db.listIntents();
    expect(intents.length).toBe(1);
    expect(intents[0].itemId).toBe("analytics-growth");
    expect(intents[0].amount).toBe(80);
    expect(intents[0].vendor).toBe("MetricFlow");
    expect(intents[0].decision).toBe("ESCALATE");
  });

  it("processes ALLOW verdict (dom-com-1y: $12 is within policy)", async () => {
    process.env.ALLOW_DEV_ROUTES = "1";
    const req = new Request("http://localhost:3000/api/dev/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: "dom-com-1y", justification: "Domain for launch" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.decision).toBe("ALLOW");
    // With no vault linked, reason explains that human approval is needed
    expect(body.reason).toContain("no PayPal wallet is linked yet");

    const intents = db.listIntents();
    expect(intents.length).toBe(1);
    expect(intents[0].itemId).toBe("dom-com-1y");
    expect(intents[0].amount).toBe(12);
    expect(intents[0].vendor).toBe("DomainHut");
    expect(intents[0].decision).toBe("ALLOW");
  });
});
