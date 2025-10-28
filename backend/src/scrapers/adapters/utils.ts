type AnyObj = Record<string, any>;

export function mergeCard(existing: AnyObj | null, result: AnyObj, url?: string) {
  return {
    ...(existing || {}),
    ...(result || {}),
    rewardsByCategory:
      result?.rewardsByCategory && result.rewardsByCategory.length
        ? result.rewardsByCategory
        : existing?.rewardsByCategory || [],
    rewardsFlat:
      result?.rewardsFlat && result.rewardsFlat.length
        ? result.rewardsFlat
        : existing?.rewardsFlat || [],
    rewardsRotating:
      result?.rewardsRotating && result.rewardsRotating.length
        ? result.rewardsRotating
        : existing?.rewardsRotating || [],
    rewardsByMerchant:
      result?.rewardsByMerchant && result.rewardsByMerchant.length
        ? result.rewardsByMerchant
        : existing?.rewardsByMerchant || [],
    perks: result?.perks?.length ? result.perks : existing?.perks || [],
    signupOffer: result?.signupOffer ?? existing?.signupOffer ?? null,
    issuer: result?.issuer ?? existing?.issuer ?? null,
    annualFee: typeof result?.annualFee === "number" ? result.annualFee : existing?.annualFee ?? 0,
    lastScraped: result?.lastScraped ?? existing?.lastScraped ?? new Date().toISOString(),
    confidence:
      typeof result?.confidence === "number"
        ? result.confidence
        : typeof existing?.confidence === "number"
        ? existing.confidence
        : 0.6,
    sourceUrl: result?.sourceUrl ?? existing?.sourceUrl ?? url ?? null,
    slug: result?.slug ?? existing?.slug, // keep stable
    name: result?.name ?? existing?.name,
    network: result?.network ?? existing?.network ?? null,
  };
}


