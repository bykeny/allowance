// Quick check that sandbox credentials work and an order can be created.
// Run: node --env-file=.env.local scripts/paypal-smoke.mjs
const base = process.env.PAYPAL_BASE ?? "https://api-m.sandbox.paypal.com";
const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) throw new Error("Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local");

const t = await fetch(`${base}/v1/oauth2/token`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials",
});
const tok = await t.json();
console.log("1. OAuth:", t.status, tok.access_token ? "token received" : JSON.stringify(tok));
if (!t.ok) process.exit(1);

const o = await fetch(`${base}/v2/checkout/orders`, {
  method: "POST",
  headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    intent: "CAPTURE",
    purchase_units: [{ amount: { currency_code: "USD", value: "1.00" }, description: "Smoke test" }],
    payment_source: {
      paypal: { experience_context: { return_url: "https://example.com/ok", cancel_url: "https://example.com/cancel" } },
    },
  }),
});
const order = await o.json();
console.log("2. Create order:", o.status, order.id ?? JSON.stringify(order));
console.log("   Approve URL:", order.links?.find((l) => ["payer-action", "approve"].includes(l.rel))?.href);
process.exit(o.ok ? 0 : 1);
