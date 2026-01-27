import type { IssuerJsonMap } from "./jsonExtract";

const sharedLabelKeys = [
  "title",
  "headline",
  "subheadline",
  "heading",
  "label",
  "name",
  "displayName",
  "featureName",
  "featureTitle",
  "benefitName",
  "benefitTitle",
  "cardBenefit",
];

const sharedDescriptionKeys = [
  "description",
  "copy",
  "details",
  "shortDescription",
  "longDescription",
  "summary",
  "subhead",
  "subheading",
  "titleText",
  "bodyText",
  "primaryText",
  "secondaryText",
  "valueText",
  "legalText",
  "content",
  "richText",
  "value",
  "body",
  "text",
  "subText",
  "subtitle",
  "legal",
  "disclosure",
];

const sharedAmountKeys = [
  "amount",
  "value",
  "amountValue",
  "amountUSD",
  "creditAmount",
  "creditValue",
  "statementCredit",
  "dollarAmount",
  "monthlyValue",
  "annualValue",
  "amountText",
  "creditText",
  "valueText",
];

const sharedPeriodKeys = [
  "period",
  "frequency",
  "interval",
  "cadence",
  "term",
  "timePeriod",
  "periodicity",
  "unit",
];

const sharedMerchantKeys = [
  "merchant",
  "partner",
  "brand",
  "provider",
  "vendor",
  "store",
  "merchantName",
  "partnerName",
];

const sharedEnrollmentKeys = [
  "enrollmentRequired",
  "requiresEnrollment",
  "optIn",
  "activationRequired",
  "requiresActivation",
  "enroll",
];

const sharedRewardKeys = [
  "rewardRate",
  "rewardRates",
  "earnRate",
  "earningRate",
  "earning",
  "rewards",
  "benefits",
  "features",
  "featureList",
  "benefitList",
  "productBenefits",
  "cardBenefits",
  "perk",
  "perks",
];

export const chaseJsonMap: IssuerJsonMap = {
  labelKeys: [...sharedLabelKeys, "categoryName", "productName"],
  descriptionKeys: [...sharedDescriptionKeys, "shortCopy"],
  amountKeys: sharedAmountKeys,
  periodKeys: sharedPeriodKeys,
  merchantKeys: sharedMerchantKeys,
  enrollmentKeys: sharedEnrollmentKeys,
  rewardKeys: sharedRewardKeys,
};

export const citiJsonMap: IssuerJsonMap = {
  labelKeys: [...sharedLabelKeys, "rewardName", "benefitHeadline"],
  descriptionKeys: [...sharedDescriptionKeys, "benefitDescription", "rewardDescription"],
  amountKeys: sharedAmountKeys,
  periodKeys: sharedPeriodKeys,
  merchantKeys: sharedMerchantKeys,
  enrollmentKeys: sharedEnrollmentKeys,
  rewardKeys: [...sharedRewardKeys, "thankyou", "tyPoints"],
};

export const discoverJsonMap: IssuerJsonMap = {
  labelKeys: [...sharedLabelKeys, "featureHeadline", "offerName"],
  descriptionKeys: [...sharedDescriptionKeys, "offerDescription"],
  amountKeys: sharedAmountKeys,
  periodKeys: sharedPeriodKeys,
  merchantKeys: sharedMerchantKeys,
  enrollmentKeys: sharedEnrollmentKeys,
  rewardKeys: [...sharedRewardKeys, "cashback", "match", "rotating"],
};

export const capitalOneJsonMap: IssuerJsonMap = {
  labelKeys: [
    ...sharedLabelKeys,
    "benefitHeading",
    "benefitLabel",
    "benefitTitle",
    "featureTitle",
    "offerTitle",
  ],
  descriptionKeys: [
    ...sharedDescriptionKeys,
    "benefitCopy",
    "featureCopy",
    "offerCopy",
    "disclaimerText",
  ],
  amountKeys: sharedAmountKeys,
  periodKeys: sharedPeriodKeys,
  merchantKeys: sharedMerchantKeys,
  enrollmentKeys: sharedEnrollmentKeys,
  rewardKeys: [...sharedRewardKeys, "miles", "cashback", "offer", "offers"],
};
