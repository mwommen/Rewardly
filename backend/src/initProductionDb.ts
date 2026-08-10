import "dotenv/config";
import {
  getAnalyticsCollection,
  getCardsCollection,
  getDecisionRuntimeCollection,
  getDecisionValidationsCollection,
  getFeedbackCollection,
  getLinkedAccountsCollection,
  getUserBenefitStatesCollection,
  connectDB,
} from "./db";
import { ensureBetaIndexes } from "./services/betaAuthService";
import { ensurePartnerPlatformIndexes } from "./services/partnerPlatformService";
import { ensureProductionAuthIndexes } from "./services/productionAuthService";
import { ensureTrustInfrastructureIndexes } from "./services/trustInfrastructureService";
import { ensureUserDataIndexes } from "./services/userDataService";

async function main() {
  await connectDB();
  await ensureBetaIndexes();
  await ensurePartnerPlatformIndexes();
  await ensureProductionAuthIndexes();
  await ensureTrustInfrastructureIndexes();
  await ensureUserDataIndexes();

  const [
    cards,
    linkedAccounts,
    benefitStates,
    analytics,
    feedback,
    decisionRuntime,
    decisionValidations,
  ] = await Promise.all([
    getCardsCollection(),
    getLinkedAccountsCollection(),
    getUserBenefitStatesCollection(),
    getAnalyticsCollection(),
    getFeedbackCollection(),
    getDecisionRuntimeCollection(),
    getDecisionValidationsCollection(),
  ]);

  await Promise.all([
    cards.createIndex({ slug: 1 }, { unique: true, sparse: true }),
    cards.createIndex({ issuer: 1, productionEligible: 1 }),
    linkedAccounts.createIndex({ userId: 1 }),
    linkedAccounts.createIndex({ itemId: 1 }, { sparse: true }),
    benefitStates.createIndex({ userId: 1, cardSlug: 1 }),
    benefitStates.createIndex({ userId: 1, benefitId: 1 }),
    analytics.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    analytics.createIndex({ installationId: 1, timestamp: -1 }),
    feedback.createIndex({ createdAt: -1 }),
    feedback.createIndex({ normalizedMerchantName: 1 }),
    decisionRuntime.createIndex(
      { decisionId: 1, ownerUserId: 1, partnerId: 1 },
      { unique: true },
    ),
    decisionRuntime.createIndex({ ownerUserId: 1, createdAt: -1 }),
    decisionRuntime.createIndex({ partnerId: 1, createdAt: -1 }),
    decisionValidations.createIndex(
      { decisionId: 1, ownerUserId: 1, partnerId: 1 },
      { unique: true },
    ),
    decisionValidations.createIndex({ validationId: 1 }, { unique: true }),
    decisionValidations.createIndex({ ownerUserId: 1, createdAt: -1 }),
    decisionValidations.createIndex({ partnerId: 1, createdAt: -1 }),
  ]);

  console.log("Rewardly production database indexes are ready.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
