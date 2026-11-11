export type Decision = "ALLOW" | "ESCALATE" | "DENY";
export type Status =
  | "REQUESTED"
  | "DENIED"
  | "AWAITING_HUMAN"
  | "CAPTURED"
  | "CANCELLED"
  | "FAILED";

export interface Policy {
  autoApproveLimit: number;
  dailyBudget: number;
  vendorAllowlist: string[];
  blockedCategories: string[];
}

export interface Intent {
  id: string;
  createdAt: string; // ISO
  itemId: string;
  itemName: string;
  vendor: string;
  category: string;
  amount: number;
  currency: string;
  justification: string;
  decision?: Decision;
  reason?: string;
  status: Status;
  orderId?: string;
  captureId?: string;
  approveUrl?: string;
  paidVia?: "VAULT" | "HUMAN_APPROVAL";
  error?: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  vendor: string;
  category: string;
  price: number;
  currency: string;
}
