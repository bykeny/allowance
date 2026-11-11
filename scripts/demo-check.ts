// Runs the three demo prompts against a running app and asserts the ledger.
// Usage: npm run demo-check -- [baseUrl]   (default http://localhost:3000)
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const TIMEOUT_MS = 120_000; // a free Render instance can take over 30 s to wake
const PAUSE_MS = 5_000;

interface Intent {
  itemId: string; amount: number; decision?: string; status: string; reason?: string; orderId?: string;
}
interface Ledger { intents: Intent[]; walletLinked: boolean }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(body: unknown) {
  const res = await fetch(`${base}/api/agent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: res.ok, status: res.status, error: json.error };
}

const rateLimited = (r: { status: number; error?: string }) => r.status === 429 || /quota is busy|rate.?limit|429/i.test(r.error ?? "");

async function main() {
  const reset = await post({ reset: true });
  if (!reset.ok) throw new Error(`reset failed: HTTP ${reset.status} ${reset.error ?? ""}`);

  const prompts = [
    "Buy a .com domain for our launch",
    "We need the Analytics Growth plan",
    "Get a $40 gift card for the team raffle",
  ];
  const errors: (string | undefined)[] = [];
  for (const [i, message] of prompts.entries()) {
    if (i) await sleep(PAUSE_MS);
    try {
      const r = await post({ message });
      errors.push(r.ok ? undefined : rateLimited(r) ? `RATE LIMITED by the model provider: ${r.error ?? "HTTP 429"}` : `HTTP ${r.status}: ${r.error ?? "no error text"}`);
    } catch (e) {
      errors.push(e instanceof Error && e.name === "TimeoutError" ? `no response within ${TIMEOUT_MS / 1000}s` : String(e));
    }
  }

  const ledger = (await (await fetch(`${base}/api/ledger`, { signal: AbortSignal.timeout(TIMEOUT_MS) })).json()) as Ledger;
  const wallet = ledger.walletLinked;
  const want = [
    { id: "dom-com-1y", amount: 12, decision: "ALLOW", status: wallet ? "CAPTURED" : "AWAITING_HUMAN", order: true, reason: wallet ? undefined : "no PayPal wallet is linked" },
    { id: "analytics-growth", amount: 80, decision: "ESCALATE", status: "AWAITING_HUMAN", order: true },
    { id: "giftcard-40", amount: 40, decision: "DENY", status: "DENIED", order: false },
  ];

  let failed = false;
  console.log(`${base}  wallet ${wallet ? "linked" : "not linked"}`);
  want.forEach((w, i) => {
    const row = ledger.intents.find((x) => x.itemId === w.id);
    const problems: string[] = [];
    if (errors[i]) problems.push(errors[i]!);
    if (!row) problems.push(`no ledger row for ${w.id}`);
    else {
      if (row.amount !== w.amount) problems.push(`amount ${row.amount}, want ${w.amount}`);
      if (row.decision !== w.decision) problems.push(`decision ${row.decision}, want ${w.decision}`);
      if (row.status !== w.status) problems.push(`status ${row.status}, want ${w.status}`);
      if (!!row.orderId !== w.order) problems.push(`orderId ${row.orderId ? "set" : "missing"}, want ${w.order ? "set" : "none"}`);
      if (w.reason && !row.reason?.includes(w.reason)) problems.push(`reason "${row.reason}" lacks "${w.reason}"`);
    }
    if (problems.length) failed = true;
    const got = row ? `${row.itemId} $${row.amount} ${row.decision}/${row.status}${row.orderId ? " order" : ""}` : "no row";
    console.log(`${problems.length ? "FAIL" : "PASS"}  ${prompts[i]}  ->  ${got}${problems.length ? `  [${problems.join("; ")}]` : ""}`);
  });
  if (ledger.intents.length !== 3) {
    failed = true;
    console.log(`FAIL  expected exactly 3 intents, found ${ledger.intents.length}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(`FAIL  ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
