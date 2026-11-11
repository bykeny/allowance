// PayPal Sandbox gateway: OAuth, Orders v2, Vault v3, webhook verification.
const BASE = () => process.env.PAYPAL_BASE ?? "https://api-m.sandbox.paypal.com";
const APP_URL = () => process.env.APP_URL ?? "http://localhost:3000";

let cached: { token: string; exp: number } | null = null;

async function token(): Promise<string> {
  if (cached && Date.now() < cached.exp) return cached.token;
  const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set");
  const r = await fetch(`${BASE()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`PayPal auth ${r.status}: ${JSON.stringify(j)}`);
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return cached.token;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function pp(path: string, body?: unknown, requestId?: string): Promise<any> {
  const r = await fetch(`${BASE()}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}), // idempotency key
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`PayPal ${r.status} on ${path}: ${JSON.stringify(j)}`);
  return j;
}

const link = (j: any, ...rels: string[]) =>
  j.links?.find((l: any) => rels.includes(l.rel))?.href as string | undefined;

export const captureIdOf = (order: any): string | undefined =>
  order?.purchase_units?.[0]?.payments?.captures?.[0]?.id;

/**
 * Create an order.
 * - with vaultId: paid from the saved PayPal wallet, no buyer present.
 * - without: returns approveUrl for a human to approve in PayPal checkout.
 */
export async function createOrder(o: {
  intentId: string;
  amount: string;
  currency: string;
  description: string;
  vaultId?: string;
}) {
  const j = await pp(
    "/v2/checkout/orders",
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: o.intentId,
          description: o.description.slice(0, 127),
          amount: { currency_code: o.currency, value: o.amount },
        },
      ],
      payment_source: {
        paypal: o.vaultId
          ? { vault_id: o.vaultId }
          : {
              experience_context: {
                user_action: "PAY_NOW",
                return_url: `${APP_URL()}/api/paypal/return?intent=${o.intentId}`,
                cancel_url: `${APP_URL()}/api/paypal/return?intent=${o.intentId}&cancelled=1`,
              },
            },
      },
    },
    `order-${o.intentId}`
  );
  return {
    id: j.id as string,
    status: j.status as string,
    approveUrl: link(j, "payer-action", "approve"),
    captureId: captureIdOf(j),
  };
}

export const captureOrder = (orderId: string) =>
  pp(`/v2/checkout/orders/${orderId}/capture`, {}, `capture-${orderId}`);

export const getOrder = (orderId: string) => pp(`/v2/checkout/orders/${orderId}`);

/** Step 1 of wallet linking: returns the setup token id and the URL the buyer approves at. */
export async function createSetupToken() {
  const j = await pp("/v3/vault/setup-tokens", {
    payment_source: {
      paypal: {
        usage_type: "MERCHANT",
        experience_context: {
          return_url: `${APP_URL()}/api/vault/return`,
          cancel_url: `${APP_URL()}/?wallet=cancelled`,
        },
      },
    },
  });
  return { id: j.id as string, approveUrl: link(j, "approve", "payer-action") };
}

/** Step 2: exchange the approved setup token for a reusable payment token (the vault_id). */
export async function createPaymentToken(setupTokenId: string): Promise<string> {
  const j = await pp("/v3/vault/payment-tokens", {
    payment_source: { token: { id: setupTokenId, type: "SETUP_TOKEN" } },
  });
  return j.id as string;
}

export async function verifyWebhook(headers: Headers, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const j = await pp("/v1/notifications/verify-webhook-signature", {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: event,
  });
  return j.verification_status === "SUCCESS";
}
