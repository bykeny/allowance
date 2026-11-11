import type { CatalogItem } from "./types";

// Fictional vendors. In the sandbox every purchase settles to the one
// merchant account that owns the REST app credentials.
export const CATALOG: CatalogItem[] = [
  { id: "dom-com-1y", name: ".com domain, 1 year", vendor: "DomainHut", category: "domains", price: 12.0, currency: "USD" },
  { id: "dom-io-1y", name: ".io domain, 1 year", vendor: "DomainHut", category: "domains", price: 39.0, currency: "USD" },
  { id: "host-basic", name: "Basic hosting, 1 month", vendor: "CloudBox", category: "hosting", price: 7.0, currency: "USD" },
  { id: "host-pro", name: "Pro hosting, 1 month", vendor: "CloudBox", category: "hosting", price: 45.0, currency: "USD" },
  { id: "analytics-starter", name: "Analytics Starter plan, 1 month", vendor: "MetricFlow", category: "software", price: 19.0, currency: "USD" },
  { id: "analytics-growth", name: "Analytics Growth plan, 1 month", vendor: "MetricFlow", category: "software", price: 80.0, currency: "USD" },
  { id: "stock-photos-10", name: "Stock photo pack (10)", vendor: "PixelMart", category: "media", price: 15.0, currency: "USD" },
  { id: "giftcard-40", name: "$40 gift card", vendor: "GiftCardCity", category: "gift_cards", price: 40.0, currency: "USD" },
  { id: "followers-5k", name: "5,000 social followers", vendor: "GrowthHax", category: "marketing", price: 9.0, currency: "USD" },
];

export function searchCatalog(query: string): CatalogItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = CATALOG.filter((i) => {
    const hay = `${i.id} ${i.name} ${i.vendor} ${i.category}`.toLowerCase();
    return words.some((w) => hay.includes(w));
  });
  return hits.length ? hits : CATALOG;
}

export const findItem = (id: string) => CATALOG.find((i) => i.id === id);
