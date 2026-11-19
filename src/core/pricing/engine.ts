import {
  BRAND_TIER_MULTIPLIER,
  CATEGORY_MAP,
  CONDITION_MAP,
  formatMxn,
  inferBrandTier,
  ZIBATA_MEETUP_ZONES,
} from "../constants/zibata";
import type { PriceRecommendation, PriceRecommendationInput } from "../types/domain";

function roundToNearest10(value: number): number {
  return Math.max(50, Math.round(value / 10) * 10);
}

export function recommendClothingPricing(input: PriceRecommendationInput): PriceRecommendation {
  const category = CATEGORY_MAP[input.category];
  const condition = CONDITION_MAP[input.condition];
  const cleanBrand = input.brand.trim() || "Estilo Campus";
  const brandTier = inferBrandTier(cleanBrand);
  const brandMultiplier = BRAND_TIER_MULTIPLIER[brandTier];

  const estimatedRetailMxn =
    input.originalPriceMxn && input.originalPriceMxn >= 100
      ? input.originalPriceMxn
      : Math.round(category.baseRetailMxn * brandMultiplier);

  const rawOptimalSale = estimatedRetailMxn * condition.depreciationMultiplier;
  const recommendedSalePriceMxn = roundToNearest10(Math.max(180, rawOptimalSale));
  const quickSalePriceMxn = roundToNearest10(Math.max(140, recommendedSalePriceMxn * 0.88));
  const maxMarketPriceMxn = roundToNearest10(recommendedSalePriceMxn * 1.15);

  const rawRentPerDay = Math.max(
    category.minRentMxn,
    recommendedSalePriceMxn * category.dailyRentRatio
  );
  const recommendedRentPerDayMxn = roundToNearest10(Math.min(rawRentPerDay, recommendedSalePriceMxn * 0.25));
  const recommendedWeekendPackMxn = roundToNearest10(recommendedRentPerDayMxn * 3 * 0.85);

  const rawDeposit = recommendedSalePriceMxn * category.depositRatio;
  const recommendedDepositMxn = roundToNearest10(Math.max(200, Math.min(rawDeposit, 3500)));

  let demandScore = category.campusDemandBase;
  if (brandTier === "streetwear" || brandTier === "luxury") demandScore += 4;
  if (brandTier === "premium") demandScore += 3;
  if (input.condition === "new_with_tags" || input.condition === "like_new") demandScore += 3;
  if (input.listingMode === "both") demandScore += 2;
  demandScore = Math.max(60, Math.min(99, demandScore));

  const demandLabel: PriceRecommendation["demandLabel"] =
    demandScore >= 88
      ? "Alta demanda en Zibatá"
      : demandScore >= 76
        ? "Demanda constante"
        : "Nicho curado";

  const zone = input.meetupZone?.trim() || ZIBATA_MEETUP_ZONES[0];
  const sizeLabel = input.size?.trim() ? `talla ${input.size.trim()}` : "";

  const categoryTitlePrefix: Record<typeof input.category, string> = {
    hoodies: "Hoodie",
    sneakers: "Sneakers",
    jackets: "Chamarra",
    dresses: "Vestido",
    denim: "Jeans",
    tops: "Top / Suéter",
    sportswear: "Conjunto Athleisure",
    accessories: "Accesorio",
  };

  const conditionTag: Record<typeof input.condition, string> = {
    new_with_tags: "Nuevo",
    like_new: "Impecable",
    good: "Buen Estado",
    fair: "Vintage",
  };

  const suggestedTitle = `${categoryTitlePrefix[input.category]} ${cleanBrand}${
    sizeLabel ? ` ${input.size?.trim()}` : ""
  } · ${conditionTag[input.condition]}`.slice(0, 88);

  const modeHint =
    input.listingMode === "rent"
      ? `Disponible para renta desde ${formatMxn(recommendedRentPerDayMxn)}/día (pack fin de semana ${formatMxn(recommendedWeekendPackMxn)}).`
      : input.listingMode === "buy"
        ? `Precio justo frente a tienda (${formatMxn(estimatedRetailMxn)} retail aprox.).`
        : `Disponible para compra (${formatMxn(recommendedSalePriceMxn)}) o renta desde ${formatMxn(recommendedRentPerDayMxn)}/día.`;

  const suggestedDescription = `${categoryTitlePrefix[input.category]} ${cleanBrand} ${
    sizeLabel ? `${sizeLabel} ` : ""
  }en condición "${condition.label.toLowerCase()}". ${condition.description} ${modeHint} Entrega segura y rápida en ${zone} o alrededores de Campus Anáhuac.`;

  const insights = [
    `Valor retail estimado de referencia: ${formatMxn(estimatedRetailMxn)} según categoría y nivel de marca (${brandTier}).`,
    `Para vender en menos de 48 h en campus, el rango óptimo está entre ${formatMxn(quickSalePriceMxn)} y ${formatMxn(recommendedSalePriceMxn)}.`,
    `La tarifa de ${formatMxn(recommendedRentPerDayMxn)}/día recupera el valor de la prenda en ~${Math.max(
      4,
      Math.round(recommendedSalePriceMxn / recommendedRentPerDayMxn)
    )} días de renta con fianza de ${formatMxn(recommendedDepositMxn)}.`,
  ];

  return {
    recommendedSalePriceMxn,
    quickSalePriceMxn,
    maxMarketPriceMxn,
    recommendedRentPerDayMxn,
    recommendedWeekendPackMxn,
    recommendedDepositMxn,
    demandScore,
    demandLabel,
    suggestedTitle,
    suggestedDescription,
    insights,
  };
}
