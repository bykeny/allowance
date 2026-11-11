// Live sandbox check of lib/paypal.ts, no Next.js server needed.
// Usage: npm run gateway:check -- create [amount] | status <orderId> | capture <orderId>
//        | vault-setup | vault-confirm <setupTokenId> | vault-pay [amount]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  createOrder, getOrder, captureOrder, captureResult, createSetupToken, createPaymentToken, PayPalError,
} from "../lib/paypal";

const VAULT_FILE = ".data/vault-check.txt"; // git-ignored; holds the full payment token id
const last4 = (s: string) => `...${s.slice(-4)}`;

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "create") {
    const o = await createOrder({
      intentId: `gc-${Date.now()}`,
      amount: arg ?? "80.00",
      currency: "USD",
      description: "gateway-check",
    });
    console.log(`order:   ${o.id}`);
    console.log(`status:  ${o.status}`);
    console.log(`approve: ${o.approveUrl ?? "(none)"}`);
  } else if ((cmd === "status" || cmd === "capture") && arg) {
    const order = cmd === "status" ? await getOrder(arg) : await captureOrder(arg);
    const c = captureResult(order);
    console.log(`order:          ${order.id}`);
    console.log(`status:         ${order.status}`);
    console.log(`capture id:     ${c.captureId ?? "(none)"}`);
    console.log(`capture status: ${c.captureStatus ?? "(none)"}`);
  } else if (cmd === "vault-setup") {
    const t = await createSetupToken();
    console.log(`setup token: ${t.id}`);
    console.log(`status:      ${t.status}`);
    console.log(`approve:     ${t.approveUrl ?? "(none)"}`);
  } else if (cmd === "vault-confirm" && arg) {
    const id = await createPaymentToken(arg);
    mkdirSync(".data", { recursive: true });
    writeFileSync(VAULT_FILE, id);
    console.log(`payment token: ${last4(id)} (saved to ${VAULT_FILE})`);
  } else if (cmd === "vault-pay") {
    const vaultId = readFileSync(VAULT_FILE, "utf8").trim();
    const o = await createOrder({
      intentId: `gc-vault-${Date.now()}`,
      amount: arg ?? "12.00",
      currency: "USD",
      description: "gateway-check vault",
      vaultId,
    });
    console.log(`vault:          ${last4(vaultId)}`);
    console.log(`order:          ${o.id}`);
    console.log(`create status:  ${o.status}`);
    const order = o.status === "COMPLETED" ? await getOrder(o.id) : await captureOrder(o.id);
    const c = captureResult(order);
    console.log(`status:         ${order.status}`);
    console.log(`capture id:     ${c.captureId ?? "(none)"}`);
    console.log(`capture status: ${c.captureStatus ?? "(none)"}`);
  } else {
    console.log("usage: gateway:check -- create [amount] | status <orderId> | capture <orderId> | vault-setup | vault-confirm <setupTokenId> | vault-pay [amount]");
    process.exit(2);
  }
}

main().catch((e) => {
  if (e instanceof PayPalError) {
    console.log(`PayPalError ${e.status}`);
    console.log(`name:     ${e.name}`);
    console.log(`issue:    ${e.issue ?? "(none)"}`);
    console.log(`desc:     ${e.description ?? "(none)"}`);
    console.log(`debug_id: ${e.debugId ?? "(none)"}`);
  } else {
    console.log(`error: ${e instanceof Error ? e.message : String(e)}`);
  }
  process.exit(1);
});
