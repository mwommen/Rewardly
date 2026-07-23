import { inferCategories } from "../utils/category";
import {
  detectMerchant,
  normalizeMerchantName,
  type Merchant,
  type MerchantDetectionInput,
} from "../../../packages/rewardly-core/src";
import { resolveMerchantIntelligence } from "./merchantIntelligenceService";

export type ResolveMerchantInput = MerchantDetectionInput & {
  merchant?: string | null;
  category?: string | null;
};

export function resolveMerchant(input: ResolveMerchantInput): Merchant {
  const intelligence = resolveMerchantIntelligence(input);
  const merchant = intelligence?.merchant || null;
  if (input.merchant?.trim()) {
    const name =
      merchant?.displayName || normalizeMerchantName(input.merchant);
    const detected = detectMerchant({
      ...input,
      title: [input.merchant, input.title].filter(Boolean).join(" "),
    });
    return {
      name,
      hostname: input.hostname || null,
      domain: input.hostname || null,
      category:
        input.category ||
        merchant?.category ||
        detected.category ||
        inferCategories(name, input.mcc || detected.mcc || undefined)[0] ||
        null,
      mcc: input.mcc || detected.mcc || null,
      confidence: Math.max(intelligence?.confidence || 0, detected.confidence || 0, 0.9),
    };
  }

  const detected = detectMerchant(input);
  return {
    ...detected,
    name: merchant?.displayName || detected.name,
    category:
      input.category ||
      merchant?.category ||
      detected.category ||
      inferCategories(
        detected.name,
        detected.mcc || input.mcc || undefined,
      )[0] ||
      null,
    confidence: Math.max(intelligence?.confidence || 0, detected.confidence || 0),
  };
}
