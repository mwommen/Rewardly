jest.mock("../src/services/walletService", () => ({
  resolveUserWallet: jest.fn(),
}));

jest.mock("../src/services/recommendationService", () => ({
  recommendBestCards: jest.fn(),
  recommendAllBenefits: jest.fn(),
}));

jest.mock("../src/services/merchantDetectionService", () => ({
  resolveMerchant: jest.fn(() => ({
    name: "Amazon",
    category: "online_shopping",
    mcc: "5942",
    confidence: 0.9,
  })),
}));

import { decidePayment } from "../src/services/paymentDecisionService";
import { resolveUserWallet } from "../src/services/walletService";
import {
  recommendAllBenefits,
  recommendBestCards,
} from "../src/services/recommendationService";

const mockedResolveUserWallet = resolveUserWallet as jest.MockedFunction<
  typeof resolveUserWallet
>;
const mockedRecommendBestCards = recommendBestCards as jest.MockedFunction<
  typeof recommendBestCards
>;
const mockedRecommendAllBenefits = recommendAllBenefits as jest.MockedFunction<
  typeof recommendAllBenefits
>;

describe("paymentDecisionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("empty wallet returns no-wallet decision and does not score every card", async () => {
    mockedResolveUserWallet.mockResolvedValueOnce({
      userId: "empty-user",
      cards: [],
      cardSlugs: [],
      source: "empty",
      benefitStates: [],
    });

    const decision = await decidePayment({
      userId: "empty-user",
      merchant: "Amazon",
      restrictToWallet: true,
    });

    expect(decision.recommendedCard).toBeNull();
    expect(decision.recommendationSummary).toBe(
      "Add cards to your wallet to get personalized recommendations.",
    );
    expect(mockedRecommendBestCards).not.toHaveBeenCalled();
    expect(mockedRecommendAllBenefits).not.toHaveBeenCalled();
  });

  test("restrictToWallet true passes wallet card slugs into scoring", async () => {
    mockedResolveUserWallet.mockResolvedValueOnce({
      userId: "gold-user",
      cards: [
        {
          slug: "amex-gold",
          name: "Amex Gold",
          issuer: "American Express",
        },
      ],
      cardSlugs: ["amex-gold"],
      source: "manual",
      benefitStates: [],
    });
    mockedRecommendBestCards.mockResolvedValueOnce({
      merchant: "Amazon",
      amount: 0,
      categoriesUsed: ["online_shopping"],
      recommendations: [
        {
          slug: "amex-gold",
          name: "Amex Gold",
          issuer: "American Express",
          effectiveRate: 0.04,
        },
      ],
    } as any);
    mockedRecommendAllBenefits.mockResolvedValueOnce({
      merchant: "Amazon",
      amount: 0,
      categoriesUsed: ["online_shopping"],
      offers: [],
    });

    const decision = await decidePayment({
      userId: "gold-user",
      merchant: "Amazon",
      restrictToWallet: true,
    });

    expect(decision.recommendedCard?.card.slug).toBe("amex-gold");
    expect(mockedRecommendBestCards).toHaveBeenCalledWith(
      expect.objectContaining({ allowedCardSlugs: ["amex-gold"] }),
    );
    expect(mockedRecommendAllBenefits).toHaveBeenCalledWith(
      expect.objectContaining({ allowedCardSlugs: ["amex-gold"] }),
    );
  });

  test("restrictToWallet false can still score full catalog for demo/search flows", async () => {
    mockedResolveUserWallet.mockResolvedValueOnce({
      userId: "demo-user",
      cards: [
        { slug: "amex-gold", name: "Amex Gold", issuer: "American Express" },
        {
          slug: "chase-sapphire-reserve",
          name: "Chase Sapphire Reserve",
          issuer: "Chase",
        },
      ],
      cardSlugs: ["amex-gold", "chase-sapphire-reserve"],
      source: "empty",
      benefitStates: [],
    });
    mockedRecommendBestCards.mockResolvedValueOnce({
      merchant: "Amazon",
      amount: 0,
      categoriesUsed: ["online_shopping"],
      recommendations: [
        {
          slug: "chase-sapphire-reserve",
          name: "Chase Sapphire Reserve",
          issuer: "Chase",
          effectiveRate: 0.1,
        },
      ],
    } as any);
    mockedRecommendAllBenefits.mockResolvedValueOnce({
      merchant: "Amazon",
      amount: 0,
      categoriesUsed: ["online_shopping"],
      offers: [],
    });

    const decision = await decidePayment({
      userId: "demo-user",
      merchant: "Amazon",
      restrictToWallet: false,
    });

    expect(decision.recommendedCard?.card.slug).toBe("chase-sapphire-reserve");
    expect(mockedRecommendBestCards).toHaveBeenCalledWith(
      expect.objectContaining({ allowedCardSlugs: undefined }),
    );
    expect(mockedRecommendAllBenefits).toHaveBeenCalledWith(
      expect.objectContaining({ allowedCardSlugs: undefined }),
    );
  });
});
