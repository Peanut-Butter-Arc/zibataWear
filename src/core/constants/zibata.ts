export type CategoryId =
  | "hoodies"
  | "sneakers"
  | "jackets"
  | "dresses"
  | "denim"
  | "tops"
  | "sportswear"
  | "accessories";

export type ConditionId = "new_with_tags" | "like_new" | "good" | "fair";

export type ListingMode = "buy" | "rent" | "both";

export type BrandTier = "luxury" | "premium" | "streetwear" | "high_street" | "basic";

export const ZIBATA_MEETUP_ZONES = [
  "Campus Anáhuac Querétaro",
  "Paseo Zibatá",
  "Xentric Anáhuac",
  "Town Center Zibatá",
  "Plaza Zielo",
  "Parque Jamadi",
] as const;

export type ZibataMeetupZone = (typeof ZIBATA_MEETUP_ZONES)[number];

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  shortLabel: string;
  baseRetailMxn: number;
  dailyRentRatio: number;
  minRentMxn: number;
  depositRatio: number;
  campusDemandBase: number;
}

export const CATEGORIES: readonly CategoryMeta[] = [
  {
    id: "hoodies",
    label: "Hoodies y Sudaderas",
    shortLabel: "Hoodies",
    baseRetailMxn: 1650,
    dailyRentRatio: 0.14,
    minRentMxn: 90,
    depositRatio: 0.4,
    campusDemandBase: 90,
  },
  {
    id: "sneakers",
    label: "Sneakers y Tenis",
    shortLabel: "Sneakers",
    baseRetailMxn: 2800,
    dailyRentRatio: 0.13,
    minRentMxn: 130,
    depositRatio: 0.45,
    campusDemandBase: 94,
  },
  {
    id: "jackets",
    label: "Chamarras y Blazers",
    shortLabel: "Chamarras",
    baseRetailMxn: 2600,
    dailyRentRatio: 0.14,
    minRentMxn: 120,
    depositRatio: 0.4,
    campusDemandBase: 88,
  },
  {
    id: "dresses",
    label: "Vestidos y Gala",
    shortLabel: "Vestidos",
    baseRetailMxn: 3900,
    dailyRentRatio: 0.16,
    minRentMxn: 220,
    depositRatio: 0.45,
    campusDemandBase: 92,
  },
  {
    id: "denim",
    label: "Denim y Pantalones",
    shortLabel: "Denim",
    baseRetailMxn: 1600,
    dailyRentRatio: 0.13,
    minRentMxn: 90,
    depositRatio: 0.35,
    campusDemandBase: 81,
  },
  {
    id: "tops",
    label: "Playeras y Suéteres",
    shortLabel: "Tops",
    baseRetailMxn: 1150,
    dailyRentRatio: 0.14,
    minRentMxn: 75,
    depositRatio: 0.35,
    campusDemandBase: 79,
  },
  {
    id: "sportswear",
    label: "Athleisure y Gym",
    shortLabel: "Sportswear",
    baseRetailMxn: 2100,
    dailyRentRatio: 0.14,
    minRentMxn: 100,
    depositRatio: 0.38,
    campusDemandBase: 86,
  },
  {
    id: "accessories",
    label: "Bolsos y Accesorios",
    shortLabel: "Accesorios",
    baseRetailMxn: 3400,
    dailyRentRatio: 0.11,
    minRentMxn: 140,
    depositRatio: 0.45,
    campusDemandBase: 84,
  },
] as const;

export const CATEGORY_MAP: Record<CategoryId, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category])
) as Record<CategoryId, CategoryMeta>;

export interface ConditionMeta {
  id: ConditionId;
  label: string;
  description: string;
  depreciationMultiplier: number;
}

export const CONDITIONS: readonly ConditionMeta[] = [
  {
    id: "new_with_tags",
    label: "Nuevo con etiqueta",
    description: "Sin usar, conserva etiquetas o empaque original.",
    depreciationMultiplier: 0.68,
  },
  {
    id: "like_new",
    label: "Como nuevo",
    description: "1 a 3 puestas, limpio y sin detalles visibles.",
    depreciationMultiplier: 0.52,
  },
  {
    id: "good",
    label: "Buen estado",
    description: "Uso ligero cuidado, listo para seguir luciendo.",
    depreciationMultiplier: 0.39,
  },
  {
    id: "fair",
    label: "Uso visible",
    description: "Marcas menores de uso reflejadas en un súper precio.",
    depreciationMultiplier: 0.27,
  },
] as const;

export const CONDITION_MAP: Record<ConditionId, ConditionMeta> = Object.fromEntries(
  CONDITIONS.map((condition) => [condition.id, condition])
) as Record<ConditionId, ConditionMeta>;

export const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export const SNEAKER_SIZES = [
  "22 MX",
  "23 MX",
  "24 MX",
  "25 MX",
  "26 MX",
  "27 MX",
  "28 MX",
  "29 MX",
  "30 MX",
] as const;
export const ACCESSORY_SIZES = ["Única", "CH", "M", "G"] as const;

export const SIZES_BY_CATEGORY: Record<CategoryId, readonly string[]> = {
  hoodies: CLOTHING_SIZES,
  sneakers: SNEAKER_SIZES,
  jackets: CLOTHING_SIZES,
  dresses: CLOTHING_SIZES,
  denim: CLOTHING_SIZES,
  tops: CLOTHING_SIZES,
  sportswear: CLOTHING_SIZES,
  accessories: ACCESSORY_SIZES,
};

export interface BrandMeta {
  name: string;
  tier: BrandTier;
}

export const POPULAR_BRANDS: readonly BrandMeta[] = [
  { name: "Coach", tier: "luxury" },
  { name: "Sandro", tier: "luxury" },
  { name: "Reformation", tier: "luxury" },
  { name: "Hugo Boss", tier: "luxury" },
  { name: "Polo Ralph Lauren", tier: "premium" },
  { name: "Massimo Dutti", tier: "premium" },
  { name: "Alo Yoga", tier: "premium" },
  { name: "Lululemon", tier: "premium" },
  { name: "COS", tier: "premium" },
  { name: "Lacoste", tier: "premium" },
  { name: "Nike", tier: "streetwear" },
  { name: "Adidas", tier: "streetwear" },
  { name: "New Balance", tier: "streetwear" },
  { name: "Carhartt WIP", tier: "streetwear" },
  { name: "Stüssy", tier: "streetwear" },
  { name: "Levi's", tier: "high_street" },
  { name: "Zara", tier: "high_street" },
  { name: "Mango", tier: "high_street" },
  { name: "Uniqlo", tier: "high_street" },
  { name: "Bershka", tier: "basic" },
  { name: "Pull&Bear", tier: "basic" },
  { name: "H&M", tier: "basic" },
] as const;

export const BRAND_TIER_MULTIPLIER: Record<BrandTier, number> = {
  luxury: 1.85,
  premium: 1.42,
  streetwear: 1.25,
  high_street: 0.95,
  basic: 0.72,
};

export const VERIFIED_UNI_DOMAINS = [
  "anahuac.mx",
  "itesm.mx",
  "tec.mx",
  "uaq.mx",
  "up.edu.mx",
  "ibero.mx",
  "unam.mx",
] as const;

export const PLATFORM_FEE_RATE = 0.07;
export const PLATFORM_FEE_PERCENT = 7;
export const PLATFORM_FEE_MIN_MXN = 15;

export function calculateBuyerServiceFeeMxn(subtotalMxn: number): number {
  if (!Number.isFinite(subtotalMxn) || subtotalMxn <= 0) return 0;
  return Math.max(
    PLATFORM_FEE_MIN_MXN,
    Math.round(subtotalMxn * PLATFORM_FEE_RATE)
  );
}

export function isUniversityEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  if (!domain) return false;
  if ((VERIFIED_UNI_DOMAINS as readonly string[]).includes(domain)) return true;
  return domain.endsWith(".edu.mx") || domain.endsWith(".edu");
}

export function extractEmailDomain(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

export function inferBrandTier(brandName: string): BrandTier {
  const normalized = brandName.trim().toLowerCase();
  const match = POPULAR_BRANDS.find((b) => b.name.toLowerCase() === normalized);
  if (match) return match.tier;
  if (
    ["gucci", "prada", "jacquemus", "maje", "tory burch", "kate spade", "balenciaga"].some(
      (k) => normalized.includes(k)
    )
  ) {
    return "luxury";
  }
  if (
    ["tommy", "calvin", "north face", "patagonia", "ralph", "gymshark", "aritzia"].some((k) =>
      normalized.includes(k)
    )
  ) {
    return "premium";
  }
  if (["jordan", "supreme", "vans", "converse", "puma", "salomon", "dickies"].some((k) => normalized.includes(k))) {
    return "streetwear";
  }
  if (["stradivarius", "oysho", "gap", "american eagle", "abercrombie"].some((k) => normalized.includes(k))) {
    return "high_street";
  }
  return "high_street";
}

export function formatMxn(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount);
}
