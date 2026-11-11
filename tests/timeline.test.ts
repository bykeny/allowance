import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { requestPurchase } from "../lib/purchase";
import { GET } from "../app/api/ledger/route";
import type { Intent } from "../lib/types";

describe("audit timeline (events)", () => {
  beforeEach(() => {
    db.reset();
  });

  afterEach(() => {
    db.reset();
  });

  it("adds events in order with timestamps and types", () => {
    const intent = db.insertIntent({
      itemId: "dom-com-1y",
      itemName: ".com domain",
      vendor: "DomainHut",
      category: "domains",
      amount: 12,
      currency: "USD",
      justification: "test",
      status: "REQUESTED",
    });

    db.addEvent(intent.id, "requested", "Domain for launch");
    db.addEvent(intent.id, "policy_verdict", "ALLOW: Within policy");
    db.addEvent(intent.id, "order_created", "ORDER-123");

    const fetched = db.getIntent(intent.id);
    expect(fetched?.events).toBeDefined();
    expect(fetched?.events?.length).toBe(3);
    expect(fetched?.events?.[0].type).toBe("requested");
    expect(fetched?.events?.[0].detail).toBe("Domain for launch");
    expect(fetched?.events?.[1].type).toBe("policy_verdict");
    expect(fetched?.events?.[2].type).toBe("order_created");
    expect(fetched?.events?.[2].detail).toBe("ORDER-123");
  });

  it("records requested and policy_verdict events on DENY", async () => {
    await requestPurchase({
      item_id: "giftcard-40",
      justification: "Raffle gift card",
    });

    const intents = db.listIntents();
    expect(intents.length).toBe(1);
    expect(intents[0].events).toBeDefined();
    expect(intents[0].events?.length).toBe(2);
    expect(intents[0].events?.[0].type).toBe("requested");
    expect(intents[0].events?.[0].detail).toBe("Raffle gift card");
    expect(intents[0].events?.[1].type).toBe("policy_verdict");
    expect(intents[0].events?.[1].detail).toContain("DENY");
  });

  it("GET /api/ledger returns intents with events, and handles legacy rows without events", async () => {
    // Add an intent with events
    const intentWithEvents = db.insertIntent({
      itemId: "dom-com-1y",
      itemName: ".com domain",
      vendor: "DomainHut",
      category: "domains",
      amount: 12,
      currency: "USD",
      justification: "new row",
      status: "REQUESTED",
    });
    db.addEvent(intentWithEvents.id, "requested", "new row");

    // Add a legacy intent without events property
    const legacyIntent: Intent = {
      id: "legacy-1",
      createdAt: new Date().toISOString(),
      itemId: "host-basic",
      itemName: "Basic hosting",
      vendor: "CloudBox",
      category: "hosting",
      amount: 7,
      currency: "USD",
      justification: "legacy row",
      status: "CAPTURED",
    };
    // Direct push without events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).insertIntent(legacyIntent);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intents).toBeDefined();
    expect(data.intents.length).toBeGreaterThanOrEqual(2);

    const foundWithEvents = data.intents.find((i: Intent) => i.id === intentWithEvents.id);
    expect(foundWithEvents?.events?.length).toBe(1);

    const foundLegacy = data.intents.find((i: Intent) => i.itemId === legacyIntent.itemId);
    expect(foundLegacy).toBeDefined();
    expect(foundLegacy?.itemName).toBe("Basic hosting");
  });
});
