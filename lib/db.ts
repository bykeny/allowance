// Tiny JSON-file store. One process, one file: enough for a demo and it has
// no native dependencies. Swap for Postgres/SQLite if you need more.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Intent, Policy } from "./types";

interface Data {
  policy: Policy;
  intents: Intent[];
  vaultId?: string;
  pendingSetupToken?: string;
}

const FILE = process.env.DATA_FILE ?? path.join(process.cwd(), ".data", "db.json");

const DEFAULTS: Data = {
  policy: {
    autoApproveLimit: 25,
    dailyBudget: 100,
    vendorAllowlist: ["DomainHut", "CloudBox", "MetricFlow", "PixelMart", "GiftCardCity"],
    blockedCategories: ["gift_cards"],
  },
  intents: [],
};

const g = globalThis as unknown as { __allowance?: Data };

function load(): Data {
  if (g.__allowance) return g.__allowance;
  try {
    g.__allowance = { ...structuredClone(DEFAULTS), ...JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ FILE, "utf8")) };
  } catch {
    g.__allowance = structuredClone(DEFAULTS);
  }
  return g.__allowance!;
}

function save() {
  try {
    fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(FILE), { recursive: true });
    fs.writeFileSync(/*turbopackIgnore: true*/ FILE, JSON.stringify(load(), null, 2));
  } catch (e) {
    console.warn("db: could not persist (continuing in memory)", e);
  }
}

export const db = {
  getPolicy: (): Policy => load().policy,
  setPolicy(patch: Partial<Policy>) {
    const d = load();
    d.policy = { ...d.policy, ...patch };
    save();
    return d.policy;
  },

  listIntents: (): Intent[] => [...load().intents].reverse(),
  getIntent: (id: string) => load().intents.find((i) => i.id === id),
  insertIntent(i: Omit<Intent, "id" | "createdAt">): Intent {
    const intent: Intent = { ...i, id: randomUUID().slice(0, 8), createdAt: new Date().toISOString() };
    load().intents.push(intent);
    save();
    return intent;
  },
  updateIntent(id: string, patch: Partial<Intent>) {
    const i = load().intents.find((x) => x.id === id);
    if (i) Object.assign(i, patch);
    save();
    return i;
  },

  spentToday(): number {
    const today = new Date().toISOString().slice(0, 10);
    return load()
      .intents.filter((i) => i.status === "CAPTURED" && i.createdAt.startsWith(today))
      .reduce((s, i) => s + i.amount, 0);
  },

  pendingToday(): number {
    const today = new Date().toISOString().slice(0, 10);
    return load()
      .intents.filter((i) => i.status === "AWAITING_HUMAN" && i.createdAt.startsWith(today))
      .reduce((s, i) => s + i.amount, 0);
  },

  getVaultId: () => load().vaultId,
  setVaultId(id: string | undefined) {
    load().vaultId = id;
    save();
  },
  getPendingSetupToken: () => load().pendingSetupToken,
  setPendingSetupToken(id: string | undefined) {
    load().pendingSetupToken = id;
    save();
  },

  reset() {
    const d = load();
    d.intents = [];
    d.policy = structuredClone(DEFAULTS.policy);
    save();
  },
};
