import "dotenv/config";
import {
  getAnalyticsCollection,
  getCardsCollection,
  getFeedbackCollection,
  getLinkedAccountsCollection,
  getUserBenefitStatesCollection,
  connectDB,
} from "./db";
import { ensureBetaIndexes } from "./services/betaAuthService";
import { ensureProductionAuthIndexes } from "./services/productionAuthService";
import { ensureTrustInfrastructureIndexes } from "./services/trustInfrastructureService";
import { ensureUserDataIndexes } from "./services/userDataService";

async function main() {
  await connectDB();
  await ensureBetaIndexes();
  await ensureProductionAuthIndexes();
  await ensureTrustInfrastructureIndexes();
  await ensureUserDataIndexes();

  const [cards, linkedAccounts, benefitStates, analytics, feedback] =
    await Promise.all([
      getCardsCollection(),
      getLinkedAccountsCollection(),
      getUserBenefitStatesCollection(),
      getAnalyticsCollection(),
      getFeedbackCollection(),
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
  ]);

  console.log("Rewardly production database indexes are ready.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
