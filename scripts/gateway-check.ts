// Live sandbox check of lib/paypal.ts, no Next.js server needed.
// Usage: npm run gateway:check -- create [amount] | status <orderId> | capture <orderId>
import { createOrder, getOrder, captureOrder, captureResult, PayPalError } from "../lib/paypal";

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
  } else {
    console.log("usage: gateway:check -- create [amount] | status <orderId> | capture <orderId>");
    process.exit(2);
  }
}

main().catch((e) => {
  if (e instanceof PayPalError) {
    console.log(`PayPalError ${e.status}`);
    console.log(`name:     ${e.name}`);
    console.log(`issue:    ${e.issue ?? "(none)"}`);
    console.log(`debug_id: ${e.debugId ?? "(none)"}`);
  } else {
    console.log(`error: ${e instanceof Error ? e.message : String(e)}`);
  }
  process.exit(1);
});
