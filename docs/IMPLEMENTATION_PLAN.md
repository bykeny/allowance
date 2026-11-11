# Allowance: Team Implementation Plan (4 members)

PayPal AI Hackathon on Devpost. Plan written Wed 11 Nov 2026, 13:00 Tallinn time.
**Hard deadline: Thu 12 Nov, 22:00 Tallinn (12:00 PT). Team target: submitted by Thu 15:00.**

| Member | Name | Link in the chain |
|---|---|---|
| M1 | **Kanan** | PayPal gateway: money actually moves |
| M2 | **Rizvan** | Decision core: policy, purchase flow, data. Also the **integrator** |
| M3 | **Seyran** | Agent: the LLM and its tools |
| M4 | **Habib** | Experience: UI, then the video |

Repo: https://gitlab.com/kananramazanov/allowance · Team chat: ______ · Submission representative: **Kanan** (change here if someone else submits)

> Role assignment (Rizvan M2, Seyran M3, Habib M4) is a default. Swap names in this table before sharing if you want a different split. Nothing else in the plan changes.

---

## 0. How to use this document

### For teammates

1. Open a new Claude chat. Attach this file and give Claude the repo (the GitLab link, or a zip of it).
2. Say: **"I am M3. Give me the prompt for task 3.1 for Claude Code."** Use Antigravity or Codex instead if you prefer, and say which.
3. Paste the prompt into your coding agent, running inside your clone of the repo, on your branch.
4. When the agent finishes, paste its summary back into the Claude chat and ask Claude to check it against the task's "Done when" list.
5. Run `npm run lint && npm run build`, commit, push, and post the task's **handoff message** in the team chat.
6. Take your next task in order. Do not skip ahead unless your next task is blocked (section 7 says what to do then).

### For Claude, when a teammate shares this file

- **If unclear, find out who they are and which task.** If they name no task, take their first task that isn't done in their list (section 8), in order.
- **Check dependencies first.** If a task's "Depends on" isn't finished, tell them, and suggest the fallback in section 7.
- **Make each prompt self-contained.** This plan is **not** in the repo, so the coding agent cannot read it. Every prompt must include:
  1. Two sentences of project context (section 1).
  2. The five invariants (section 1), verbatim.
  3. The member's owned files, and that other files are off-limits except where the task says so.
  4. The task's goal, steps and "Done when", verbatim.
  5. Any contract from section 5 that the task uses or changes.
  6. "Check current documentation for PayPal, the Anthropic SDK, AG Grid and Next.js instead of assuming APIs. This repo uses Next.js 16, which has breaking changes; its docs are in `node_modules/next/dist/docs/`."
  7. "When finished, run `npm run lint && npm run build` (and `npm test` once it exists). Report exactly what you verified and what you could not verify. Do not mock PayPal or LLM responses to make something pass. Stop after this task."
- **Split big tasks.** If a task looks longer than about 90 minutes of agent work, split it into 2–3 prompts, run in order, each ending in a commit.
- **Match the tool.** Claude Code reads `CLAUDE.md` (which imports `AGENTS.md`); Antigravity and Codex read `AGENTS.md`. Keep prompts tool-neutral except where the teammate asks otherwise.
- **Never put credentials in a prompt.** The agent reads them from `.env.local`.

---

## 1. The project in one page

**Allowance** is a spend firewall for AI agents. A user gives an agent a goal. The agent shops from a catalog and requests purchases. A deterministic policy engine decides each request:

| Verdict | When | What PayPal does |
|---|---|---|
| `ALLOW` | Allowed vendor and category, under the auto-approve limit, within budget | Order paid from a vaulted PayPal wallet, no human present |
| `ESCALATE` | Over the limit, over the daily budget, or a likely duplicate | Order created; a human approves it in PayPal checkout |
| `DENY` | Vendor not on the allowlist, or blocked category | No order. Reason logged |

Every request appears in a live audit ledger (AG Grid) with the agent's justification, the rule that fired, and the PayPal order and capture IDs.

**Pitch:** nobody hands an AI agent a credit card, so we gave it an allowance.

```
 M4: UI              M3: Agent                M2: Decision core                     M1: PayPal gateway
┌──────────┐     ┌─────────────────┐     ┌─────────────────────────────────┐     ┌──────────────────────┐
│ Chat     │────►│ POST /api/agent │────►│ request_purchase → policy.ts     │────►│ Orders v2, Vault v3  │
│ Policy   │     │ LLM tool loop   │     │  ALLOW / ESCALATE / DENY         │     │ /api/paypal/return   │
│ Ledger   │◄────│                 │     │ db (ledger, policy, events)      │◄────│ /api/paypal/webhook  │
└──────────┘     └─────────────────┘     └─────────────────────────────────┘     └──────────────────────┘
      ▲                                            │
      └───────────── GET /api/ledger (poll 1.5 s) ─┘
```

Intent lifecycle: `REQUESTED → DENIED | AWAITING_HUMAN | CAPTURED | FAILED`, then `AWAITING_HUMAN → CAPTURED | CANCELLED | FAILED`.

### Invariants (every prompt must include these)

1. The model never calls PayPal. The only spending path is `request_purchase` → `lib/policy.ts` → `lib/paypal.ts`.
2. Prices, vendors and categories come from the catalog, never from the model.
3. The policy engine is deterministic: no LLM calls inside `lib/policy.ts`.
4. Sandbox only (`api-m.sandbox.paypal.com`). No secrets in git, prompts or screenshots.
5. No mocked PayPal or LLM responses in the app. If a call fails, the ledger shows the error.

---

## 2. Rules that shape the work

Official rules: https://paypalaihackathon.devpost.com/rules

- **Five criteria, equally weighted:** Technological Implementation, Design, Potential Impact, Innovation, Presentation. Design and the video are 40% of the score.
- **Required to submit:**
  - A public code repository (GitHub, Bitbucket and GitLab are all allowed) with a license file detectable on the repo page. Ours is on GitLab, the MIT `LICENSE` is already there, and the project visibility must be set to **Public** before submitting.
  - A working demo: a hosted URL or clear run instructions. Mockups don't count.
  - A video under 3:00, public on YouTube, with no copyrighted music and no third-party trademarks.
  - Free access for judges until 15 Dec. Sandbox test logins go in the README or the Devpost description.
  - PayPal integration must be central to the project.
- **Prizes we aim at:**
  - Best Use of Agentic Commerce and Best Use of PayPal + AI.
  - AG Grid and Render sponsor prizes.
  - One project can win one main prize plus one sponsor prize.

---

## 3. Repo state at the start

Next.js 16 (App Router, TypeScript, Tailwind 4), Anthropic SDK, AG Grid Community 36, JSON-file store. `npm run lint` and `npm run build` pass. The policy engine passed six manual cases. **Nothing that calls PayPal or the LLM has been run yet, and the UI has never been opened in a browser.** Treat that code as a first draft to verify.

| File | What it is | Owner |
|---|---|---|
| `lib/paypal.ts` | OAuth, Orders v2, Vault v3, webhook verification | M1 |
| `app/api/paypal/return`, `app/api/paypal/webhook` | PayPal redirect and webhook handlers | M1 |
| `app/api/vault/setup`, `app/api/vault/return` | Wallet linking | M1 |
| `scripts/paypal-smoke.mjs` (`npm run smoke:paypal`) | Credential check, creates a $1 order | M1 |
| `render.yaml` | Render blueprint | M1 |
| `lib/policy.ts` | Policy rules | M2 |
| `lib/purchase.ts` | Request → policy → PayPal orchestration | M2 |
| `lib/db.ts`, `lib/types.ts` | Store and shared types | M2 |
| `lib/catalog.ts` | Nine fictional catalog items | M2 |
| `app/api/ledger`, `app/api/policy` | Ledger and policy APIs | M2 |
| `README.md` | Public README | M2 (others add sections) |
| `lib/agent.ts` | System prompt, tool schemas, tool loop | M3 |
| `app/api/agent` | Chat endpoint and reset | M3 |
| `app/page.tsx`, `app/layout.tsx`, `app/globals.css` | Page shell | M4 |
| `components/Chat.tsx`, `PolicyBar.tsx`, `Ledger.tsx` | UI components | M4 |
| `public/` | Static assets | M4 |
| `AGENTS.md`, `CLAUDE.md` | Rules for coding agents | M2 |

**Shared-file rule:** only the owner edits a file. If you need a change in someone else's file, ask them in chat, or make a small additive change and tag the owner in the commit message. Shared types (`lib/types.ts`) only get new optional fields, never renamed or removed ones.

---

## 4. How we work

- **One branch per member:** `m1-gateway`, `m2-core`, `m3-agent`, `m4-ui`. Rebase on `main` after every gate.
- **Gates:** at each gate (section 6), everyone pushes. M2 merges in chain order, **M1 → M2 → M3 → M4**, running `npm run lint && npm run build && npm test` after each merge. Then the team runs the gate check together.
- **Commits:** one task per commit or a few, message format `3.2: multi-item goals`.
- **Handoff messages:** when a task unblocks someone, post the handoff line from the task card in the team chat.
- **Stuck rule:** if your agent fails on the same error twice, stop it, post the error in chat, and move to your next unblocked task.
- **Secrets:** shared once by M1 through a private channel. Everyone keeps them in `.env.local`, which git ignores.

---

## 5. Contracts between the links

These are the seams that let four people work in parallel. **Changing a contract means: post it in chat, update this section, and tell the consumer.**

### Gateway contract (M1 → M2), `lib/paypal.ts`

```ts
createOrder(o: { intentId: string; amount: string; currency: string; description: string; vaultId?: string })
  : Promise<{ id: string; status: string; approveUrl?: string; captureId?: string }>
captureOrder(orderId: string): Promise<PayPalOrder>     // idempotent via PayPal-Request-Id
getOrder(orderId: string): Promise<PayPalOrder>
captureIdOf(order: PayPalOrder): string | undefined
createSetupToken(): Promise<{ id: string; approveUrl?: string }>
createPaymentToken(setupTokenId: string): Promise<string>  // returns vault_id
verifyWebhook(headers: Headers, event: unknown): Promise<boolean>
```

With `vaultId`, the order is paid without a buyer. Without it, the human pays at `approveUrl`, and PayPal redirects to `/api/paypal/return?intent=<id>` (or `&cancelled=1`).

### Core contract (M2 → M3, M4)

```ts
requestPurchase({ item_id: string; justification: string }): Promise<{
  intent_id?: string; decision?: "ALLOW" | "ESCALATE" | "DENY"; reason?: string;
  status?: Status; order_id?: string; note?: string; error?: string }>
```

| Endpoint | Request | Response | Notes |
|---|---|---|---|
| `GET /api/ledger` | | `{ intents: Intent[]; policy: Policy; spentToday: number; walletLinked: boolean }` | Intents newest first |
| `PUT /api/policy` | partial `Policy` | full `Policy` | |
| `POST /api/dev/purchase` | `{ item_id, justification }` | `requestPurchase` result | **New in 2.2.** Runs through the policy; enabled only when `ALLOW_DEV_ROUTES=1` |
| `GET /api/catalog/meta` | | `{ items, vendors, categories }` | **New in 2.5** |
| `db.addEvent(intentId, type, detail?)` | | | **New in 2.4.** Fills `Intent.events: { at: string; type: string; detail?: string }[]` |

`Intent`, `Policy` and `Status` are defined in `lib/types.ts`.

### Agent contract (M3 → M4)

```
POST /api/agent         { message: string } → { reply: string; trace: { name; input; output }[] } | { error }
POST /api/agent         { reset: true }     → { ok: true }   // clears chat history and ledger
POST /api/agent/stream  { message: string } → text/event-stream     (new in 3.4)
   event: tool_start   data: { name, input }
   event: tool_result  data: { name, output }
   event: text         data: { delta }
   event: done         data: {}
   event: error        data: { message }
```

---

## 6. Master sequence

All times are Tallinn time. Tasks inside a phase run in parallel across members and in order within one member's list.

| Phase | When | M1: Gateway | M2: Core | M3: Agent | M4: Experience |
|---|---|---|---|---|---|
| **0 Setup** | Wed 13:30–14:30 | **1.1** Sandbox and credentials | Setup (sec. 9) | Setup | Setup |
| **1 Foundation** | Wed 14:30–17:30 | **1.2** Gateway and return route | **2.1** Policy tests → **2.2** Dev purchase route | **3.1** Verify the tool loop | **4.1** First run and layout |
| ▶ **Gate 1** | **Wed 17:30** | Escalation path works end to end in the UI, through both the agent and the dev route | | | |
| **2 Core** | Wed 17:30–20:30 | **1.3** Vault wallet (90-min timebox) → **1.4** Deploy to Render | **2.3** Budget reservation → **2.4** Audit timeline | **3.2** Replies and multi-item → **3.3** Red team | **4.2** Ledger UX and AG Grid → **4.3** Detail panel |
| ▶ **Gate 2** | **Wed 20:30** | Vault go/no-go decided. Hosted URL live. Timeline visible in UI | | | |
| **3 Hardening** | Wed 20:30–23:30 | **1.5** Webhook and keep-alive | **2.5** Policy API and persistence | **3.4** Streaming → **3.5** Demo check and robustness | **4.4** Policy editor and live chat → **4.5** Polish and diagram |
| ▶ **Gate 3** | **Wed 23:30** | `demo-check` passes on the hosted URL 3× in a row. **Feature freeze** | | | |
| **4 Ship** | Thu 09:00–15:00 | **1.6** Judge access and PayPal docs | **2.6** Clean-clone test and README | **3.6** Devpost text | **4.6** Video |
| ▶ **Submit** | **Thu by 15:00** | Representative submits (section 11) | | | |
| Buffer | Thu 15:00–22:00 | Text fixes only. No code changes after the video is recorded | | | |

### Dependencies

```
1.1 ──► 1.2 ──► 1.3 ──► 1.4 ──► 1.5 ──► 1.6
 │       ▲               ▲ (needs Gate 1 merge)
 ├──► 2.2┘ (1.2's return-route check needs 2.2)
 │     2.1 ──► 2.2 ──► 2.3 ──► 2.4 ──► 2.5 ──► 2.6
 │                       ▲ (3.3 findings)      ▲ (needs all of Gate 3)
 └──► 3.1 ──► 3.2 ──► 3.3 ──► 3.4 ──► 3.5 ──► 3.6
      4.1 ──► 4.2 ──► 4.3 ──► 4.4 ──► 4.5 ──► 4.6
              ▲ 2.2     ▲ 2.4   ▲ 2.5, 3.4      ▲ Gate 3 (hosted demo)
```

### Estimated effort (to keep the split even)

| Member | Wed | Thu | Total |
|---|---|---|---|
| M1 | 1.1 (1 h) · 1.2 (3 h) · 1.3 (1.5 h) · 1.4 (1.5 h) · 1.5 (2 h) | 1.6 (2 h) | ~11 h |
| M2 | 2.1 (1 h) · 2.2 (2 h) · 2.3 (1.5 h) · 2.4 (1.5 h) · 2.5 (2 h) + gates (1.5 h) | 2.6 (2 h) | ~11.5 h |
| M3 | 3.1 (3 h) · 3.2 (1.5 h) · 3.3 (1.5 h) · 3.4 (1.5 h) · 3.5 (1.5 h) | 3.6 (2.5 h) | ~11.5 h |
| M4 | 4.1 (3 h) · 4.2 (1.5 h) · 4.3 (1.5 h) · 4.4 (1.5 h) · 4.5 (1.5 h) | 4.6 (3 h) | ~12 h |

---

## 7. If you're blocked

| You're waiting on | Do this meanwhile |
|---|---|
| Credentials (1.1) | Read the code you own, run `npm run dev`, prepare your first prompt |
| Dev purchase route (2.2), as M4 | Build empty, loading and error states; style the policy bar |
| Gateway check (1.2), as M2 or M3 | `DENY` cases need no PayPal call, so test those first |
| Audit timeline (2.4), as M4 | Build the detail panel from the fields that already exist |
| Streaming (3.4), as M4 | Finish the policy editor half of 4.4 first |
| Anything for over 30 minutes | Say so in chat. M2 decides whether to reorder |

---

## 8. Task cards

Each card lists: priority (**P0** = no submission without it, **P1** = needed for a strong demo, **P2** = stretch), when, dependencies, files, steps, "Done when", and the handoff message to post.

### M1: PayPal gateway

Owns: `lib/paypal.ts`, `app/api/paypal/*`, `app/api/vault/*`, `scripts/*`, `render.yaml`.

#### 1.1 Sandbox accounts and credentials
- **P0** · Phase 0 · Depends on: nothing · Files: none (dashboard work), `.env.local`
- Steps:
  1. In the PayPal Developer Dashboard (sandbox), confirm there is a **Business** and a **Personal** test account. Set a known password on the Personal one.
  2. Create a second Personal account for judges (`judge-…@personal.example.com`). Don't share its password yet.
  3. Create a REST app named "Allowance" under the Business account. Copy the client ID and secret.
  4. Fill `.env.local` and run `npm run smoke:paypal`.
  5. Send all teammates the `.env.local` values, the Personal login and an Anthropic key, through a private channel.
- Done when: every member's `npm run smoke:paypal` prints an order ID and an approve URL.
- Handoff: **"1.1 done: credentials sent, smoke test passes."** Unblocks 1.2, 2.2, 3.1.

#### 1.2 Gateway verified, including the return route
- **P0** · Phase 1 · Depends on: 1.1; for steps 3–5, 2.2 · Files: `lib/paypal.ts`, `app/api/paypal/return/route.ts`, `scripts/gateway-check.ts` (new)
- Steps:
  1. Write `scripts/gateway-check.ts` (run with `npx tsx`). It calls `createOrder` without a vaultId, prints the approve URL, waits for Enter, then calls `captureOrder` and prints the capture ID. Run it and approve with the sandbox Personal account.
  2. Compare response shapes with PayPal's Orders v2 docs: link rel names, capture ID location, status values. Fix `lib/paypal.ts` where they differ.
  3. Once 2.2 is merged into your branch, call `POST /api/dev/purchase` for `analytics-growth` ($80, ESCALATE). Open the Approve button in the UI and pay. Confirm the redirect lands on `/` and the intent becomes `CAPTURED` with a capture ID.
  4. Cancel in PayPal on a second purchase. Confirm `CANCELLED`.
  5. Reload a used return URL. Confirm there is no double capture and no error page.
- Done when: steps 1–5 pass, and the captures are visible in the sandbox Business account's activity.
- Handoff: **"1.2 done: approval path verified, capture IDs in ledger."**

#### 1.3 Vault wallet linking (timebox: 90 minutes)
- **P1** · Phase 2 · Depends on: 1.2 · Files: `lib/paypal.ts`, `app/api/vault/*`, `lib/purchase.ts` (vault branch only, tell M2)
- Steps:
  1. Read PayPal's docs for saving PayPal as a payment method with the Payment Method Tokens API (v3 vault). Find which setting must be enabled on the sandbox app and enable it.
  2. Verify `createSetupToken` → redirect → `/api/vault/return` → `createPaymentToken`. Check what PayPal appends to `return_url` and use it if needed.
  3. Verify an order created with `payment_source.paypal.vault_id` completes with no buyer present. Handle both `COMPLETED` and `APPROVED` responses.
- Done when: "Link PayPal wallet" completes in the UI, and a $12 domain purchase via the agent ends `CAPTURED` with `paidVia: VAULT` and no browser step.
- **If not done at 90 minutes:** stop. The fallback already works: in-policy purchases use the approval link with the reason "no wallet linked". Report at Gate 2. Second option, only if the team agrees: pay `ALLOW` through the Payouts API.
- Handoff: **"1.3 vault: GO"** or **"1.3 vault: NO-GO, fallback active."** M4 adjusts the video line at 0:50 to match.

#### 1.4 Deploy to Render
- **P0** · Phase 2 · Depends on: Gate 1 merged to `main` · Files: `render.yaml`
- Steps:
  1. Create a Render Blueprint from the repo's `main`. Set the env vars, then `APP_URL` = the Render URL. Set `ALLOW_DEV_ROUTES=0`.
  2. Turn on auto-deploy on push to `main`.
  3. Run the three demo prompts (section 12) on the hosted URL, including one full approval in PayPal.
- Done when: the hosted URL passes all three prompts, and the approval redirect returns to the hosted URL, not localhost.
- Handoff: **"1.4 done: live at <url>."**

#### 1.5 Webhook, keep-alive, timeline events
- **P1** · Phase 3 · Depends on: 1.4, 2.4 · Files: `app/api/paypal/*`, `app/api/vault/*`
- Steps:
  1. In the sandbox app, add a webhook to `<render-url>/api/paypal/webhook` for `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.CAPTURE.DENIED`. Put its ID in `PAYPAL_WEBHOOK_ID` on Render.
  2. Confirm a real capture is verified and updates the ledger. Confirm an unsigned `curl` POST gets 400.
  3. Add `db.addEvent(...)` calls in the return, webhook and vault routes: `approved_by_human`, `captured`, `cancelled`, `webhook_received`, `wallet_linked`.
  4. Set up an external ping (any free uptime monitor) of `<render-url>/api/ledger` every 10 minutes, so the free instance doesn't sleep during judging.
- Done when: steps 1–4 are verified on the hosted URL.
- Handoff: **"1.5 done: webhook verified, keep-alive on."**

#### 1.6 Judge access and PayPal docs (Thursday)
- **P0** · Phase 4 · Depends on: Gate 3
- Steps:
  1. Run the three prompts on the hosted URL first thing. Fix only real breakage, and tell M2 before pushing.
  2. Give the judge sandbox login to the representative for the Devpost "testing instructions" field.
  3. Write the README section "PayPal integration": APIs used, the flow per verdict, and sandbox setup for anyone running locally.
  4. Stretch (P2): a Refund action using `POST /v2/payments/captures/{id}/refund`, only if approved by the team before 11:00.
- Done when: the README section is merged, the judge login is tested in a private browser window, and the hosted demo is healthy.

---

### M2: Decision core and integration

Owns: `lib/policy.ts`, `lib/purchase.ts`, `lib/db.ts`, `lib/types.ts`, `lib/catalog.ts`, `app/api/ledger`, `app/api/policy`, `app/api/dev/*`, `app/api/catalog/*`, `tests/*`, `README.md`, `AGENTS.md`, `CLAUDE.md`.
Also runs every gate merge (section 4).

#### 2.1 Policy unit tests
- **P1** · Phase 1 · Depends on: nothing · Files: `tests/policy.test.ts`, `package.json`
- Steps:
  1. Add vitest and an `npm test` script.
  2. Cover every rule in `evaluate()`:
     - allowlist, blocked category, duplicate within 10 minutes, daily budget, auto-approve limit;
     - edges: zero or negative amount, amount exactly at the limit, exactly at the budget, a duplicate older than 10 minutes, a duplicate of a DENIED intent (must not escalate).
  3. Update `AGENTS.md` so the pre-commit check is `npm run lint && npm run build && npm test`.
- Done when: `npm test` passes, with at least 12 cases.

#### 2.2 Dev purchase route and purchase-flow check
- **P0** · Phase 1 · Depends on: 1.1 · Files: `app/api/dev/purchase/route.ts` (new), `lib/purchase.ts`
- Steps:
  1. Add `POST /api/dev/purchase { item_id, justification }`. It calls `requestPurchase`, so it goes through the policy. It returns 404 unless `ALLOW_DEV_ROUTES=1`.
  2. Run all three verdicts:
     - `dom-com-1y`: ALLOW, or ESCALATE with "no wallet linked" until 1.3 lands;
     - `analytics-growth`: ESCALATE;
     - `giftcard-40`: DENY.
  3. Check each ledger row: amount from the catalog, verdict, reason, `orderId` set except for DENY, and errors shown on failure.
- Done when: the three calls give the expected rows, and the route is unreachable without the flag.
- Handoff: **"2.2 done: dev purchase route on main. `ALLOW_DEV_ROUTES=1` to use."** Unblocks 1.2 steps 3–5 and 4.2.

#### 2.3 Budget reservation and evasion rules
- **P1** · Phase 2 · Depends on: 2.1 · Files: `lib/policy.ts`, `lib/db.ts`, `tests/*`
- Steps:
  1. Count `AWAITING_HUMAN` intents against the daily budget, so the agent can't queue unlimited approvals. `CANCELLED` and `FAILED` release the reservation.
  2. Show both numbers in the reason, e.g. "45.00 captured + 80.00 pending of 100.00".
  3. Make the duplicate rule match on `itemId`, not only vendor and amount.
  4. Apply any policy gaps M3 reports from 3.3 (they arrive later in Phase 2).
  5. Extend the tests.
- Done when: the tests cover reservation and release; two pending $80 requests mean a third purchase escalates for budget.

#### 2.4 Audit timeline in the data model
- **P1** · Phase 2 · Depends on: 2.2 · Files: `lib/types.ts`, `lib/db.ts`, `lib/purchase.ts`
- Steps:
  1. Add an optional `events: { at: string; type: string; detail?: string }[]` to `Intent`, and `db.addEvent(intentId, type, detail?)`.
  2. Record events in `purchase.ts`: `requested`, `policy_verdict` (with the reason), `order_created`, `captured` (vault), `failed`.
- Done when: `GET /api/ledger` shows ordered events for each intent, and older rows without `events` still render.
- Handoff: **"2.4 done: `db.addEvent` and `Intent.events` on main."** Unblocks 4.3 and 1.5 step 3.

#### 2.5 Policy API, catalog meta, persistence
- **P1** · Phase 3 · Depends on: 2.3 · Files: `app/api/policy`, `app/api/catalog/meta` (new), `lib/db.ts`
- Steps:
  1. `PUT /api/policy` validates `vendorAllowlist` and `blockedCategories` against the catalog's real vendors and categories. Unknown values get a 400 with a message.
  2. Add `GET /api/catalog/meta → { items, vendors, categories }`.
  3. Make "Reset demo" restore the default policy and an empty ledger, but **keep the linked wallet**.
  4. Document in the README that Render's free tier loses the ledger on restart.
- Done when: an invalid policy edit is rejected with a clear error, a valid one changes the next verdict, and reset keeps the wallet.
- Handoff: **"2.5 done: catalog meta and full policy editing."** Unblocks 4.4.

#### 2.6 Clean-clone test and README (Thursday)
- **P0** · Phase 4 · Depends on: Gate 3
- Steps:
  1. In a new folder, clone `main`, follow the README word for word, and fix every gap.
  2. Collect the README sections from M1 (PayPal) and M3 (agent and safety). Write "How it works" and the architecture section, and embed M4's diagram.
  3. Confirm the GitLab project is set to **Public** (Settings → General → Visibility, in a private window, the repo must open without logging in) and that the project overview shows the MIT license.
  4. Run `git log -p | grep -iE "secret|client_id|sk-ant"` to confirm no secret was ever committed. If one was, rotate it.
- Done when: a clean clone runs from the README alone, and the secret scan is clean.

---

### M3: Agent

Owns: `lib/agent.ts`, `app/api/agent/*`, `scripts/demo-check.ts` (new), `docs/RED_TEAM.md` (new).

#### 3.1 Verify the tool loop against the API
- **P0** · Phase 1 · Depends on: 1.1 · Files: `lib/agent.ts`, `app/api/agent/route.ts`
- Steps:
  1. Check the installed Anthropic SDK's tool-use types and confirm the `MODEL` value is a valid model ID.
  2. Send the three demo prompts (section 12) with `curl` to `POST /api/agent`. Record the tool trace and reply for each.
  3. Confirm history stays valid across turns: every `tool_use` has a `tool_result`. Confirm a forced API error (bad key) doesn't corrupt the next turn.
  4. Confirm `{ reset: true }` clears the history.
- Done when: the three prompts produce the expected verdicts through the agent, across at least two consecutive turns.
- Handoff: **"3.1 done: agent verified."**

#### 3.2 Reply quality and multi-item goals
- **P1** · Phase 2 · Depends on: 3.1 · Files: `lib/agent.ts`
- Steps:
  1. Tune the system prompt so replies are at most three short sentences, name each item's verdict and quote the policy reason.
  2. For ESCALATE, the reply points to the "Approve in PayPal" button and says nothing about retrying.
  3. Handle the multi-item goal "Set up our launch site: domain, hosting and analytics" with one `request_purchase` per item and one summary.
  4. Check `get_budget_status` before the first purchase.
- Done when: five consecutive runs of the multi-item goal give consistent, accurate summaries.

#### 3.3 Red team
- **P1** · Phase 2 · Depends on: 3.1 · Files: `lib/agent.ts`, `docs/RED_TEAM.md` (new)
- Steps:
  1. Try at least 10 attacks:
     - splitting a purchase, retrying a denied item, claiming admin rights;
     - asking for a different vendor for a blocked category, inventing an item not in the catalog;
     - prompt injection inside the request ("ignore your rules"), asking the agent to raise its own limit;
     - repeating the same purchase fast, mixing a blocked item into a multi-item goal.
  2. Record for each: what the model tried, the policy verdict, and whether money moved.
  3. Tighten the prompt where the model behaved badly.
  4. Send any case where **only** the model stopped it to M2 as a policy rule.
- Done when: `docs/RED_TEAM.md` has the table, and no attack moved money outside policy.
- Handoff: **"3.3 findings for M2: …"**

#### 3.4 Streaming endpoint
- **P1** · Phase 3 · Depends on: 3.2 · Files: `app/api/agent/stream/route.ts` (new), `lib/agent.ts`
- Steps:
  1. Add `POST /api/agent/stream`, returning `text/event-stream` with the events in section 5.
  2. Keep `POST /api/agent` working unchanged.
  3. Tool events go out the moment each tool starts and finishes.
- Done when: `curl -N` shows `tool_start` and `tool_result` events arriving before `done`, and the non-streaming endpoint still passes 3.1.
- Handoff: **"3.4 done: stream endpoint on main, contract unchanged."** Unblocks 4.4.

#### 3.5 Demo check script and robustness
- **P1** · Phase 3 · Depends on: 3.2 · Files: `scripts/demo-check.ts` (new), `package.json`, `lib/agent.ts`
- Steps:
  1. Write `npm run demo-check -- <baseUrl>`. It resets, sends the three demo prompts, reads `/api/ledger`, and asserts the verdicts: ALLOW (or ESCALATE with "no wallet linked" if vault is NO-GO), ESCALATE, DENY. Exit code 0 or 1.
  2. In the agent loop, add a timeout per LLM call, one retry on overload or 5xx, and a clear user-facing error.
- Done when: `demo-check` passes against localhost and the hosted URL. M2 uses it at Gate 3.

#### 3.6 Devpost text (Thursday)
- **P0** · Phase 4 · Depends on: Gate 3
- Steps:
  1. Turn section 13 into final text, using real details from teammates: challenges, numbers, red-team results.
  2. Add the README section "Agent and safety": tools, invariants, a red-team summary.
  3. Prepare the "Built with" tags.
  4. With M4, choose 3–5 screenshots for the gallery.
- Done when: the text is in the shared doc by 12:00 and reviewed by one teammate.

---

### M4: Experience and video

Owns: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/*`, `public/*`.

#### 4.1 First run and layout
- **P0** · Phase 1 · Depends on: nothing (runs without credentials) · Files: M4's files
- Steps:
  1. Run `npm run dev` and open the page at 1440×900 and 1280×720. Fix layout, hydration warnings and console errors.
  2. Confirm AG Grid 36 renders with the theming API, with no legacy CSS imports.
  3. Make sure the empty, loading and error states read well.
  4. Once 2.2 lands, create rows with the dev route and check each status renders.
- Done when: no console errors at either size, and a screenshot is posted in chat.

#### 4.2 Ledger UX and AG Grid depth
- **P0** · Phase 2 · Depends on: 2.2 · Files: `components/Ledger.tsx`
- Steps:
  1. Make the outcomes clear at a glance in a 1080p recording: green ALLOW / CAPTURED, amber ESCALATE / AWAITING, red DENY / FAILED.
  2. Make "Approve in PayPal" the most obvious action on the screen. Flash rows when they change. Set sensible column widths.
  3. For the AG Grid sponsor prize: column filters, a "Group by verdict" toggle, a pinned totals row, and CSV export of the audit log.
- Done when: a teammate unfamiliar with the UI can name each row's outcome in under 3 seconds.

#### 4.3 Row detail panel
- **P1** · Phase 2 · Depends on: 2.4 (start before it lands, using existing fields) · Files: `components/IntentDetail.tsx` (new), `app/page.tsx`
- Steps:
  1. Clicking a row opens a side panel with:
     - item, vendor, amount;
     - the agent's justification;
     - the policy verdict and reason;
     - PayPal order and capture IDs, with copy buttons;
     - the `events` timeline.
- Done when: one click answers "why was this paid or blocked?" for each verdict.

#### 4.4 Policy editor and live chat
- **P1** · Phase 3 · Depends on: 2.5, then 3.4 · Files: `components/PolicyBar.tsx`, `components/Chat.tsx`
- Steps:
  1. Add allowlist and blocked-category editing with chips, using `GET /api/catalog/meta` and showing validation errors from `PUT /api/policy`.
  2. Switch the chat to `POST /api/agent/stream`, showing tool steps live as they arrive. Fall back to `POST /api/agent` if streaming errors.
- Done when: blocking a category changes the next verdict live, and tool steps appear while the agent works.

#### 4.5 Visual polish and architecture diagram
- **P1** · Phase 3 · Depends on: 4.2 · Files: M4's files, `public/architecture.svg` (new)
- Steps:
  1. Polish typography, spacing and the header. Add a favicon. Make the "wallet linked" state obvious.
  2. Avoid generic template looks, and don't use PayPal's logo or wordmark as artwork.
  3. Draw an architecture diagram, based on section 1, for the README and the video.
- Done when: the team agrees at Gate 3 that it looks like a product. **No UI changes after 23:30.**

#### 4.6 Video (Thursday)
- **P0** · Phase 4 · Depends on: Gate 3, 1.6 step 1
- Steps:
  1. Record on the **hosted** URL, following the script in section 14. Log in to the sandbox Personal account beforehand so approval takes one click. Press "Reset demo" before each take.
  2. Use 1080p and browser zoom 110%. No music, no third-party logos.
  3. Edit to under 2:55 and upload to YouTube as **Public**.
  4. Check the link in a private window and send it to the representative.
- Done when: the public link plays in a private window and the video runs under 3:00.

---

## 9. Setup for every member (Phase 0)

```bash
git clone <repo-url> && cd allowance
git checkout -b m<N>-<name>        # m1-gateway | m2-core | m3-agent | m4-ui
cp .env.example .env.local         # values from M1, private channel only
npm install
npm run smoke:paypal               # once M1 has sent credentials
npm run dev                        # http://localhost:3000
```

Needs Node 20 or newer. Add `ALLOW_DEV_ROUTES=1` to `.env.local` once 2.2 is merged.

---

## 10. Gate procedure (M2 runs it, everyone attends, 15 minutes)

1. Everyone pushes their branch and posts what is done and what isn't.
2. M2 merges into `main` in chain order, **M1 → M2 → M3 → M4**, running `npm run lint && npm run build && npm test` after each merge. If a merge breaks the build, that branch's owner fixes it first.
3. Run the gate check:
   - **Gate 1:** ESCALATE → Approve → CAPTURED works in the UI, through the agent and through the dev route. DENY works.
   - **Gate 2:**
     - Vault GO/NO-GO is decided and the video line adjusted.
     - The hosted URL is live.
     - The timeline is in the ledger data.
   - **Gate 3:** `npm run demo-check -- <render-url>` passes three times in a row. Then **feature freeze**: only bug fixes, and only through M2.
4. Everyone rebases on `main` and starts the next phase.

---

## 11. Thursday submission sequence

| Time | Who | Step |
|---|---|---|
| 09:00 | M1 | Health check of the hosted demo (1.6 step 1) |
| 09:00–12:00 | All | 1.6, 2.6, 3.6, 4.6 in parallel |
| 12:00 | M3 | Devpost text ready for review |
| 13:00 | M4 | Video public on YouTube |
| 13:00–14:00 | M2 | Final README merge, clean-clone test, secret scan |
| 14:00 | Representative | Fill in the Devpost form: name, tagline, text, "Built with", repo URL, demo URL, video URL, gallery images, testing instructions with the judge sandbox login. Invite all teammates to the project |
| 14:30 | All | Each member checks the submission page and confirms they're listed |
| 15:00 | Representative | **Submit**, and confirm the email arrives |
| until 22:00 | | Text edits only. The repo stays frozen after the video |

---

## 12. The three demo prompts

| # | Prompt | Expected |
|---|---|---|
| 1 | `Buy a .com domain for our launch` | $12, **ALLOW**, CAPTURED via vault. If vault is NO-GO: ESCALATE, reason "no wallet linked" |
| 2 | `We need the Analytics Growth plan` | $80, **ESCALATE** → Approve in PayPal → CAPTURED |
| 3 | `Get a $40 gift card for the team raffle` | **DENY**, blocked category |

Default policy: auto-approve up to $25, $100 daily budget, `gift_cards` blocked.

---

## 13. Devpost text draft (owner: M3; replace brackets with what really happened)

**Inspiration.** AI agents can now research, compare and decide, but nobody gives them a wallet, because the only options are full access or none. Companies solved this for employees years ago with spend policies. We built the same thing for agents.

**What it does.** Allowance gives an AI agent a PayPal-backed budget with rules. You give the agent a goal. It finds what to buy and requests each purchase with a written justification. A deterministic policy engine decides. In-policy purchases are paid instantly from a vaulted PayPal wallet. Over-limit purchases pause and send a human a PayPal approval link. Out-of-policy purchases are denied. Every decision lands in a live audit ledger with the agent's reasoning, the rule that fired and the PayPal capture ID.

**How we built it.** Next.js and TypeScript. The agent is Claude with four tools. It never touches PayPal directly, and prices come from the catalog rather than the model. PayPal integration:
- Orders v2 for all payments.
- Vault v3 payment tokens for unattended in-policy captures.
- The standard approval flow for human escalation.
- Signed webhooks for settlement status.

The ledger is AG Grid and the app runs on Render. Four of us built it in parallel with AI coding agents, each owning one link of the chain from agent to payment.

**Challenges.** [Vault setup in sandbox, redirect handling, keeping the model from working around limits, coordinating four coding agents on one codebase.]

**Accomplishments.** [Real sandbox money moves on three different paths from one sentence of instruction. The model can't bypass the rules because the rules aren't in the model. Red-team: N attacks, zero out-of-policy payments.]

**What we learned.** [Fill in.]

**What's next.**
- Per-agent budgets for multi-agent teams.
- Payouts for agent-to-vendor settlement.
- Policies written in plain language and compiled to rules.
- Exposing Allowance as an MCP server so any agent can use it.

---

## 14. Video script, 2:50 (owner: M4)

| Time | Screen | Voiceover |
|---|---|---|
| 0:00–0:25 | Title card, then the empty dashboard | "Would you give an AI agent your credit card? Neither would we. So we gave it an allowance." |
| 0:25–0:50 | Policy bar: $25 auto-approve, $100 a day, blocked categories | "The rules live in code, not in the prompt." |
| 0:50–1:15 | Prompt 1 → green row, CAPTURED | "In policy. Paid from the linked PayPal wallet, no human needed." *(If vault is NO-GO: "In policy, so it goes straight to one-click approval.")* |
| 1:15–1:50 | Prompt 2 → amber row → Approve → PayPal checkout → green | "Over the limit, so the agent stops and asks. One click in PayPal." |
| 1:50–2:05 | Prompt 3 → red row | "Blocked category. Denied, with the reason logged." |
| 2:05–2:20 | Detail panel timeline, then the same capture in the PayPal sandbox dashboard | "Every decision is auditable down to the PayPal capture ID." |
| 2:20–2:40 | Architecture diagram | "Claude proposes. The policy engine decides. PayPal executes." |
| 2:40–2:50 | Repo URL and live URL | "Allowance. Spending rules for the agent economy." |

---

## 15. Risks and cut order

| Risk | Sign | Response | Owner |
|---|---|---|---|
| Vault doesn't work in sandbox | 1.3 not done at 90 min | Approval-link fallback (already built); adjust the video line | M1 |
| LLM errors during recording | 500s from `/api/agent` | Retry from 3.5; record in short takes | M3 |
| Render cold start while judges test | First load over 30 s | Keep-alive from 1.5; note in README | M1 |
| Ledger lost on Render restart | Empty ledger after idle | Acceptable; documented in README | M2 |
| Merge conflicts | Same file on two branches | File ownership; merge only at gates | M2 |
| An agent mocks a failing call | Hard-coded responses in a diff | Invariant 5; reviewer rejects the diff | Everyone |
| Behind schedule at Gate 2 | P1 tasks still open | Cut, in this order: 4.4 streaming half → 3.4 → 1.5 webhook (keep keep-alive) → AG Grid extras in 4.2 (step 3) → 2.5 → 3.3 → 4.3 | M2 decides |

---

## 16. Definition of done

- [ ] The three demo prompts give the expected verdicts on the **hosted** URL (`demo-check` passes 3×)
- [ ] Captures are visible in the PayPal sandbox Business account
- [ ] `npm run lint && npm run build && npm test` pass on `main`
- [ ] A clean clone runs from the README alone
- [ ] The GitLab repo is public (checked in a private window), the MIT license shows on the project page, and the secret scan is clean
- [ ] The video is public on YouTube and under 3:00
- [ ] The Devpost submission is sent, all four members are listed, and the judge test login is included
