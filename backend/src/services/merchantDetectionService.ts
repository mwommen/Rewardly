import { inferCategories } from "../utils/category";
import {
  detectMerchant,
  normalizeMerchantName,
  type Merchant,
  type MerchantDetectionInput,
} from "../../../packages/rewardly-core/src";

export type ResolveMerchantInput = MerchantDetectionInput & {
  merchant?: string | null;
  category?: string | null;
};

export function resolveMerchant(input: ResolveMerchantInput): Merchant {
  if (input.merchant?.trim()) {
    const name = normalizeMerchantName(input.merchant);
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
        detected.category ||
        inferCategories(name, input.mcc || detected.mcc || undefined)[0] ||
        null,
      mcc: input.mcc || detected.mcc || null,
      confidence: 0.9,
    };
  }

  const detected = detectMerchant(input);
  return {
    ...detected,
    category:
      input.category ||
      detected.category ||
      inferCategories(
        detected.name,
        detected.mcc || input.mcc || undefined,
      )[0] ||
      null,
  };
}
