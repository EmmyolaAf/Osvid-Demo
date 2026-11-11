import { PricingTierItem, ProductVariation } from "@/types/auth";

export interface VariantFlashSaleConfig {
  discountType?: "percentage" | "fixed_amount";
  discountValue?: number;
  badgeText?: string;
  startsAt?: string;
  endsAt?: string;
  isActive?: boolean;
}

export interface CalculateEffectiveVariantPriceParams {
  baseProductPrice: number;
  variant?: Partial<ProductVariation> & {
    priceOverride?: number;
    costPrice?: number;
    minPriceFloor?: number;
    flashSale?: VariantFlashSaleConfig;
    discountType?: "percentage" | "fixed_amount";
    discountValue?: number;
    badgeText?: string;
    startsAt?: string;
    endsAt?: string;
    isFlashSaleActive?: boolean;
    pricingTiers?: PricingTierItem[];
    capacity?: number;
  };
  quantity: number;
  cumulativeProductVolume?: number;
  volumeDiscountThreshold?: number;
  volumeDiscountPercentage?: number;
  now?: Date;
}

export interface EffectiveVariantPriceResult {
  unitPrice: number;
  baseUnitPrice: number;
  discountAmount: number;
  discountPercentage: number;
  appliedTier?: PricingTierItem;
  appliedFlashSale?: {
    discountType: "percentage" | "fixed_amount";
    discountValue: number;
    badgeText?: string;
    savings: number;
  };
  isVolumeWholesaleApplied: boolean;
  isFloorEnforced: boolean;
  minPriceFloor?: number;
  savingsPerUnit: number;
  lineTotal: number;
  standardLineTotal: number;
  totalSavings: number;
}

/**
 * Pure, deterministic variant pricing and multi-tiered discount engine.
 *
 * Order of operations:
 * 1. Base Price Resolution: variant priceOverride (or regularPrice/price) || product basePrice.
 * 2. Active Promotional / Flash Discount: evaluates date window and deduction (percentage or fixed).
 * 3. Volume Quantity Tier Evaluation: matches order quantity against variant tier ladders.
 * 4. Cross-Variant Volume Wholesale Equivalent: evaluates cumulative container volume vs product wholesale threshold.
 * 5. Cost Floor Guardrail Enforcement: ensures unitPrice never drops below minPriceFloor.
 */
export function calculateEffectiveVariantPrice(
  params: CalculateEffectiveVariantPriceParams
): EffectiveVariantPriceResult {
  const {
    baseProductPrice,
    variant,
    quantity = 1,
    cumulativeProductVolume = 0,
    volumeDiscountThreshold = 0,
    volumeDiscountPercentage = 0,
    now = new Date(),
  } = params;

  const qty = Math.max(1, Number(quantity) || 1);

  // 1. Base Price Resolution
  const rawBase =
    variant?.priceOverride !== undefined && variant.priceOverride !== null
      ? Number(variant.priceOverride)
      : variant?.regularPrice !== undefined && variant.regularPrice !== null
      ? Number(variant.regularPrice)
      : variant?.price !== undefined && variant.price !== null
      ? Number(variant.price)
      : Number(baseProductPrice);

  const baseUnitPrice = Math.max(0, isNaN(rawBase) ? 0 : rawBase);
  let currentUnitPrice = baseUnitPrice;

  // 2. Active Promotional / Flash Discount
  let appliedFlashSale: EffectiveVariantPriceResult["appliedFlashSale"] = undefined;

  const flashSaleConfig = variant?.flashSale || {
    discountType: variant?.discountType,
    discountValue: variant?.discountValue,
    badgeText: variant?.badgeText,
    startsAt: variant?.startsAt || (variant as any)?.saleStartDate,
    endsAt: variant?.endsAt || (variant as any)?.saleEndDate,
    isActive: variant?.isFlashSaleActive !== undefined ? variant.isFlashSaleActive : Boolean(variant?.discountValue),
  };

  if (
    flashSaleConfig.isActive &&
    flashSaleConfig.discountValue !== undefined &&
    flashSaleConfig.discountValue > 0
  ) {
    const isWithinWindow = (() => {
      const nowTime = now.getTime();
      if (flashSaleConfig.startsAt) {
        const startTime = new Date(flashSaleConfig.startsAt).getTime();
        if (!isNaN(startTime) && nowTime < startTime) return false;
      }
      if (flashSaleConfig.endsAt) {
        const endTime = new Date(flashSaleConfig.endsAt).getTime();
        if (!isNaN(endTime) && nowTime > endTime) return false;
      }
      return true;
    })();

    if (isWithinWindow) {
      let promoPrice = currentUnitPrice;
      if (flashSaleConfig.discountType === "fixed_amount") {
        promoPrice = Math.max(0, currentUnitPrice - Number(flashSaleConfig.discountValue));
      } else {
        // Percentage discount
        const pct = Math.min(100, Math.max(0, Number(flashSaleConfig.discountValue)));
        promoPrice = Math.round(currentUnitPrice * (1 - pct / 100));
      }

      appliedFlashSale = {
        discountType: flashSaleConfig.discountType || "percentage",
        discountValue: Number(flashSaleConfig.discountValue),
        badgeText: flashSaleConfig.badgeText || "Promotional Sale",
        savings: Math.max(0, currentUnitPrice - promoPrice),
      };

      currentUnitPrice = promoPrice;
    }
  } else if (variant?.salePrice !== undefined && Number(variant.salePrice) > 0 && Number(variant.salePrice) < currentUnitPrice) {
    // Legacy / simple salePrice field compatibility
    const saleVal = Number(variant.salePrice);
    appliedFlashSale = {
      discountType: "fixed_amount",
      discountValue: currentUnitPrice - saleVal,
      badgeText: "Sale Price",
      savings: currentUnitPrice - saleVal,
    };
    currentUnitPrice = saleVal;
  }

  // 3. Volume Quantity Tier Evaluation
  const tiers = Array.isArray(variant?.pricingTiers) ? variant.pricingTiers : [];
  let appliedTier: PricingTierItem | undefined = undefined;
  let tierDiscountPct = 0;
  let tierPriceOverride: number | undefined = undefined;

  if (tiers.length > 0) {
    const matchingTiers = tiers.filter((t) => {
      const minOk = typeof t.minQuantity === "number" ? qty >= t.minQuantity : true;
      const maxOk = typeof t.maxQuantity === "number" && t.maxQuantity > 0 ? qty <= t.maxQuantity : true;
      return minOk && maxOk;
    });

    if (matchingTiers.length > 0) {
      // Pick tier with highest discount or lowest tier price
      const sorted = [...matchingTiers].sort((a, b) => {
        const aPct = Number(a.discountPercentage || 0);
        const bPct = Number(b.discountPercentage || 0);
        return bPct - aPct;
      });
      appliedTier = sorted[0];

      if (appliedTier.discountPercentage && Number(appliedTier.discountPercentage) > 0) {
        tierDiscountPct = Number(appliedTier.discountPercentage);
      } else if (appliedTier.tierPrice && Number(appliedTier.tierPrice) > 0) {
        tierPriceOverride = Number(appliedTier.tierPrice);
      } else if (appliedTier.unitPrice && Number(appliedTier.unitPrice) > 0) {
        tierPriceOverride = Number(appliedTier.unitPrice);
      }
    }
  }

  // 4. Cross-Variant Volume Wholesale Equivalent
  let volumeWholesalePct = 0;
  const vThreshold = Number(volumeDiscountThreshold) || 0;
  const vDiscountPct = Number(volumeDiscountPercentage) || 0;

  if (vThreshold > 0 && cumulativeProductVolume >= vThreshold && vDiscountPct > 0) {
    volumeWholesalePct = vDiscountPct;
  }

  // Determine best discount between quantity tier and cross-variant volume wholesale
  const bestVolumeDiscountPct = Math.max(tierDiscountPct, volumeWholesalePct);
  const isVolumeWholesaleApplied = volumeWholesalePct >= tierDiscountPct && volumeWholesalePct > 0;

  let postVolumePrice = currentUnitPrice;
  if (bestVolumeDiscountPct > 0) {
    const pct = Math.min(100, Math.max(0, bestVolumeDiscountPct));
    // Apply discount against the base unit price (standard volume ladder rule)
    const discountedFromBase = Math.round(baseUnitPrice * (1 - pct / 100));
    postVolumePrice = Math.min(currentUnitPrice, discountedFromBase);
  } else if (tierPriceOverride !== undefined) {
    postVolumePrice = Math.min(currentUnitPrice, tierPriceOverride);
  }

  // 5. Cost Floor Guardrail Enforcement
  const minFloor =
    variant?.minPriceFloor !== undefined && variant.minPriceFloor !== null
      ? Number(variant.minPriceFloor)
      : undefined;

  let isFloorEnforced = false;
  let finalUnitPrice = postVolumePrice;

  if (minFloor !== undefined && !isNaN(minFloor) && minFloor > 0) {
    if (finalUnitPrice < minFloor) {
      finalUnitPrice = minFloor;
      isFloorEnforced = true;
    }
  }

  const savingsPerUnit = Math.max(0, baseUnitPrice - finalUnitPrice);
  const discountAmount = savingsPerUnit;
  const discountPercentage = baseUnitPrice > 0 ? Math.round((savingsPerUnit / baseUnitPrice) * 100) : 0;
  const lineTotal = finalUnitPrice * qty;
  const standardLineTotal = baseUnitPrice * qty;
  const totalSavings = standardLineTotal - lineTotal;

  return {
    unitPrice: finalUnitPrice,
    baseUnitPrice,
    discountAmount,
    discountPercentage,
    appliedTier,
    appliedFlashSale,
    isVolumeWholesaleApplied,
    isFloorEnforced,
    minPriceFloor: minFloor,
    savingsPerUnit,
    lineTotal,
    standardLineTotal,
    totalSavings,
  };
}

/**
 * Computes the Cartesian Product of all configured attribute groups.
 * Permutations = Product of |Options_i|
 */
export function generateCartesianCombinations(
  attributeGroups: { name: string; values: string[] }[],
  maxLimit: number = 300
): { attributes: Record<string, string>; combinationKey: string }[] {
  const validGroups = attributeGroups.filter(
    (g) => g.name.trim().length > 0 && Array.isArray(g.values) && g.values.length > 0
  );

  if (validGroups.length === 0) return [];

  const totalPermutations = validGroups.reduce((acc, g) => acc * g.values.length, 1);
  if (totalPermutations > maxLimit) {
    throw new Error(
      `Cartesian permutation limit exceeded: ${totalPermutations} combinations requested (maximum allowable is ${maxLimit}).`
    );
  }

  let combinations: Record<string, string>[] = [{}];

  for (const group of validGroups) {
    const nextAcc: Record<string, string>[] = [];
    for (const existing of combinations) {
      for (const val of group.values) {
        nextAcc.push({
          ...existing,
          [group.name.trim()]: val.trim(),
        });
      }
    }
    combinations = nextAcc;
  }

  return combinations.map((attrs) => {
    const key = Object.entries(attrs)
      .map(([k, v]) => `${k}:${v}`)
      .sort()
      .join("|");
    return {
      attributes: attrs,
      combinationKey: key,
    };
  });
}

