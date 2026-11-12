import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/paypal", () => ({ verifyWebhook: async () => true }));

import { POST } from "../app/api/paypal/webhook/route";
import { db } from "../lib/db";

const hook = (type: string, id: string) =>
  POST(
    new Request("http://localhost:3000/api/paypal/webhook", {
      method: "POST",
      body: JSON.stringify({ event_type: type, resource: { id: "CAP1", custom_id: id } }),
    }),
  );

describe("POST /api/paypal/webhook status guard", () => {
  beforeEach(() => db.reset());

  it("does not overwrite a terminal intent", async () => {
    const i = db.insertIntent({ status: "CANCELLED" } as never);
    await hook("PAYMENT.CAPTURE.COMPLETED", i.id);
    expect(db.getIntent(i.id)?.status).toBe("CANCELLED");
  });
});
