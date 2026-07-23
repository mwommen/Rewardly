import type { CanonicalBenefitRecord, PurchaseChannel } from "./benefitIntelligenceService";

export type BenefitEligibilityReasonCode =
  | "BENEFIT_EXPIRED"
  | "BENEFIT_NOT_EFFECTIVE"
  | "BENEFIT_REJECTED"
  | "BENEFIT_UNVERIFIED"
  | "BENEFIT_NOT_PRODUCTION_ELIGIBLE"
  | "BENEFIT_CONFIDENCE_TOO_LOW"
  | "BENEFIT_MISSING_MATCHING_INFORMATION"
  | "BENEFIT_PURCHASE_CHANNEL_INCOMPATIBLE"
  | "BENEFIT_RESTRICTION_INCOMPATIBLE"
  | "BENEFIT_ENROLLMENT_REQUIRED"
  | "BENEFIT_ACTIVATION_REQUIRED"
  | "BENEFIT_USER_STATUS_UNKNOWN";

export type BenefitEligibilityContext = {
  now?: Date;
  merchant?: string;
  merchantCategory?: string;
  purchaseChannel?: PurchaseChannel;
  minimumConfidence?: number;
  productionOnly?: boolean;
  enrolledBenefitIds?: string[];
  activatedBenefitIds?: string[];
  knownEnrollmentBenefitIds?: string[];
  knownActivationBenefitIds?: string[];
};

export type BenefitEligibilityResult =
  | { eligible: true; reasonCode: null; explanation: string }
  | {
      eligible: false;
      reasonCode: BenefitEligibilityReasonCode;
      explanation: string;
    };

const DEFAULT_MINIMUM_CONFIDENCE = 0.7;

export function isBenefitEligibleForRecommendation(
  benefit: CanonicalBenefitRecord,
  context: BenefitEligibilityContext = {},
): BenefitEligibilityResult {
  const now = context.now || new Date();
  const productionOnly = context.productionOnly ?? true;
  const minimumConfidence =
    context.minimumConfidence ?? DEFAULT_MINIMUM_CONFIDENCE;

  if (benefit.expirationDate && new Date(benefit.expirationDate) < now) {
    return reject(
      "BENEFIT_EXPIRED",
      `Benefit expired on ${benefit.expirationDate}`,
    );
  }

  if (benefit.effectiveDate && new Date(benefit.effectiveDate) > now) {
    return reject(
      "BENEFIT_NOT_EFFECTIVE",
      `Benefit becomes effective on ${benefit.effectiveDate}`,
    );
  }

  if (benefit.verificationStatus === "rejected") {
    return reject("BENEFIT_REJECTED", "Benefit has been rejected in review");
  }

  if (
    productionOnly &&
    !["verified"].includes(benefit.verificationStatus)
  ) {
    return reject(
      "BENEFIT_UNVERIFIED",
      `Benefit status is ${benefit.verificationStatus}`,
    );
  }

  if (productionOnly && !benefit.productionEligible) {
    return reject(
      "BENEFIT_NOT_PRODUCTION_ELIGIBLE",
      "Benefit is not approved for production recommendations",
    );
  }

  if (benefit.confidenceScore < minimumConfidence) {
    return reject(
      "BENEFIT_CONFIDENCE_TOO_LOW",
      `Benefit confidence ${benefit.confidenceScore} is below ${minimumConfidence}`,
    );
  }

  if (!hasRequiredMatchingInformation(benefit)) {
    return reject(
      "BENEFIT_MISSING_MATCHING_INFORMATION",
      "Benefit is missing merchant, category, or general applicability metadata",
    );
  }

  if (!channelApplies(benefit, context.purchaseChannel)) {
    return reject(
      "BENEFIT_PURCHASE_CHANNEL_INCOMPATIBLE",
      `Benefit does not apply to ${context.purchaseChannel} purchases`,
    );
  }

  if (!merchantApplies(benefit, context)) {
    return reject(
      "BENEFIT_RESTRICTION_INCOMPATIBLE",
      "Benefit does not apply to this merchant or category",
    );
  }

  if (productionOnly && benefit.enrollmentRequired) {
    const enrolledIds = new Set(context.enrolledBenefitIds || []);
    const knownIds = new Set(context.knownEnrollmentBenefitIds || []);
    if (enrolledIds.has(benefit.id)) {
      // Known enrolled state is eligible.
    } else if (knownIds.has(benefit.id)) {
      return reject(
        "BENEFIT_ENROLLMENT_REQUIRED",
        "Benefit requires enrollment and the user is not enrolled",
      );
    } else {
      return reject(
        "BENEFIT_USER_STATUS_UNKNOWN",
        "Benefit requires enrollment but user enrollment state is unknown",
      );
    }
  }

  if (productionOnly && benefit.activationRequired) {
    const activatedIds = new Set(context.activatedBenefitIds || []);
    const knownIds = new Set(context.knownActivationBenefitIds || []);
    if (activatedIds.has(benefit.id)) {
      // Known activated state is eligible.
    } else if (knownIds.has(benefit.id)) {
      return reject(
        "BENEFIT_ACTIVATION_REQUIRED",
        "Benefit requires activation and the user has not activated it",
      );
    } else {
      return reject(
        "BENEFIT_USER_STATUS_UNKNOWN",
        "Benefit requires activation but user activation state is unknown",
      );
    }
  }

  return {
    eligible: true,
    reasonCode: null,
    explanation: "Benefit is eligible for recommendation scoring",
  };
}

function reject(
  reasonCode: BenefitEligibilityReasonCode,
  explanation: string,
): BenefitEligibilityResult {
  return { eligible: false, reasonCode, explanation };
}

function hasRequiredMatchingInformation(benefit: CanonicalBenefitRecord) {
  if (benefit.sourceKind === "reward_flat") return true;
  if (benefit.benefitType === "signup_offer") return true;
  return Boolean(
    benefit.merchantCategory ||
      benefit.specificMerchant ||
      benefit.specificMerchantIds.length ||
      benefit.eligiblePurchaseChannels.includes("any"),
  );
}

function channelApplies(
  benefit: CanonicalBenefitRecord,
  purchaseChannel: PurchaseChannel | undefined,
) {
  if (!purchaseChannel) return true;
  return (
    benefit.eligiblePurchaseChannels.includes("any") ||
    benefit.eligiblePurchaseChannels.includes(purchaseChannel)
  );
}

function merchantApplies(
  benefit: CanonicalBenefitRecord,
  context: BenefitEligibilityContext,
) {
  const merchant = normalize(context.merchant);
  const category = normalize(context.merchantCategory);
  if (!merchant && !category) return true;
  if (benefit.sourceKind === "reward_flat") return true;
  const merchants = [
    benefit.specificMerchant,
    ...benefit.specificMerchantIds,
  ].map(normalize);

  if (merchants.some((item) => item && merchant.includes(item))) return true;
  if (benefit.merchantCategory && normalize(benefit.merchantCategory) === category) {
    return true;
  }
  if (!merchants.length && !benefit.merchantCategory) return true;
  return !merchant && !category;
}

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
