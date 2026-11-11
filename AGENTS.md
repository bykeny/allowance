<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules (Allowance)

Read `docs/IMPLEMENTATION_PLAN.md` before starting. It has the task list, file ownership and acceptance criteria.

- **The model never calls PayPal.** The only spending path is `request_purchase` → `lib/policy.ts` → `lib/paypal.ts`. Do not add tools that bypass the policy engine, and do not let the model supply prices.
- **Policy stays deterministic.** No LLM calls inside `lib/policy.ts`.
- **Sandbox only.** `PAYPAL_BASE` must stay on `api-m.sandbox.paypal.com`. Never commit `.env.local` or any secret.
- **Stay in your workstream's files** (see the plan). If you need to change a shared file (`lib/types.ts`, `lib/db.ts`), keep the change additive and say so in the commit message.
- **Before every commit:** `npm run lint && npm run build && npm test` must pass.
- **Do not fake results.** No mock PayPal responses in the app; if a sandbox call fails, surface the error in the ledger.
- Small commits, one task per commit, message format `A3: capture on return`.
