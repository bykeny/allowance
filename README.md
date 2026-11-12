# Allowance

**Spending rules for AI agents, backed by PayPal.**

Nobody hands an AI agent a credit card. Allowance gives it a budget with rules instead:

| The agent asks to buy… | Policy verdict | What PayPal does |
|---|---|---|
| something small and in policy | `ALLOW` | Order paid from a vaulted PayPal wallet, no human present |
| something over the limit or budget | `ESCALATE` | Order created; a human approves it in PayPal checkout |
| a blocked category or unknown vendor | `DENY` | Nothing. The reason is logged |

Every request lands in an audit ledger with the agent's justification, the rule that fired, and the PayPal order and capture IDs.

The model never talks to PayPal. It can only call `request_purchase`; a deterministic policy engine (`lib/policy.ts`) sits between that tool and the PayPal gateway, and prices come from the catalog, not from the model.

## Live demo and judge access

- **Live app:** https://allowance-g8sh.onrender.com/ (free hosting: the first load can take up to a minute while the instance wakes up)
- **Sandbox only.** No real money moves. Everything runs against the PayPal Sandbox.
- **Sandbox buyer account** (use it when PayPal asks you to log in to link the wallet or approve a payment):
  - Email: `<SANDBOX_BUYER_EMAIL>`
  - Password: `<SANDBOX_BUYER_PASSWORD>`
- **How to try it:** click **Link PayPal wallet** and approve with the buyer account, then follow *Demo in three prompts* below. **Reset demo** clears the ledger.
- If the wallet shows as not linked after a restart, click **Link PayPal wallet** again.
- This is a single-user demo: there is no login, so anyone with the link can change the policy or reset the demo, and visitors share one agent conversation.

## Run it

Requires Node 20+.

```bash
git clone <this repo> && cd allowance
cp .env.example .env.local   # fill in the values below
npm install
npm run dev                  # http://localhost:3000
```

### Credentials

1. **PayPal sandbox app.** In the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox), create a REST app under your sandbox *Business* account. Copy the client ID and secret into `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`. To use unattended payments, enable the app's Vault / "save payment methods" feature.
2. **Sandbox buyer.** Under *Testing Tools → Sandbox Accounts*, note the email and password of a *Personal* account. You log in with it when approving a payment or linking the wallet.
3. **LLM key.** The agent uses any OpenAI-compatible endpoint with tool calling. The default is Groq's free tier: create a key at [console.groq.com](https://console.groq.com) (no card needed) and set `LLM_API_KEY`. `LLM_BASE_URL` and `LLM_MODEL` switch provider or model (see `.env.example` for a Gemini example).
4. **Webhook (optional, needs a public URL).** Add a webhook for `{APP_URL}/api/paypal/webhook` subscribed to `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.CAPTURE.DENIED`, and put its ID in `PAYPAL_WEBHOOK_ID`. Without it the app still works: captures are confirmed on the return redirect.

## Demo in three prompts

Click **Link PayPal wallet** first and approve with the sandbox buyer. Then:

1. `Buy a .com domain for our launch` → $12, **ALLOW**, captured from the vaulted wallet.
2. `We need the Analytics Growth plan` → $80, **ESCALATE**, click *Approve in PayPal*, row turns to CAPTURED.
3. `Get a $40 gift card for the team raffle` → **DENY**, blocked category.

If no wallet is linked, in-policy purchases fall back to the human approval link.

## How it works

```
Chat UI ──► /api/agent (LLM tool loop) ──► request_purchase ──► Policy engine (pure code)
                                                          ALLOW │ ESCALATE │ DENY
                                                                ▼          ▼
                                              Order + vault_id     Order + approval link
                                              (auto-captured)      (human pays, then capture)
                                                        └── PayPal Sandbox ──► webhook
Ledger (AG Grid) ◄── polls /api/ledger
```

| Path | What it does |
|---|---|
| `lib/policy.ts` | The spend rules: allowlist, blocked categories, duplicate check, daily budget, auto-approve limit |
| `lib/purchase.ts` | Runs a request through policy, then through PayPal |
| `lib/paypal.ts` | OAuth, Orders v2, Vault v3 setup/payment tokens, webhook signature verification |
| `lib/agent.ts` | Tool schema and the tool-calling loop |
| `lib/db.ts` | JSON-file store (`.data/db.json`) |
| `app/api/*` | `agent`, `ledger`, `policy`, `vault/setup`, `vault/return`, `paypal/return`, `paypal/webhook` |
| `components/*` | Chat, policy bar, AG Grid ledger |
| `docs/IMPLEMENTATION_PLAN.md` | Team plan, task list and agent prompts |

PayPal APIs used: `POST /v1/oauth2/token`, `POST /v2/checkout/orders`, `POST /v2/checkout/orders/{id}/capture`, `POST /v3/vault/setup-tokens`, `POST /v3/vault/payment-tokens`, `POST /v1/notifications/verify-webhook-signature`.

## Deploy

`render.yaml` is included. Create a Blueprint on Render from this repo, fill in the secret env vars, and set `APP_URL` to the Render URL. The free tier has no persistent disk, so the ledger resets when the instance restarts. Set `DEFAULT_VAULT_ID` to a vault payment-token ID to keep a linked wallet across restarts.

## License

MIT
