describe("payment decision sandbox mode", () => {
  const originalSandboxMode = process.env.REWARDLY_SANDBOX_MODE;

  afterEach(() => {
    if (originalSandboxMode === undefined) {
      delete process.env.REWARDLY_SANDBOX_MODE;
    } else {
      process.env.REWARDLY_SANDBOX_MODE = originalSandboxMode;
    }
    jest.resetModules();
    jest.dontMock("../src/db");
  });

  test("runs through PaymentDecisionService without external database access", async () => {
    process.env.REWARDLY_SANDBOX_MODE = "true";

    jest.doMock("../src/db", () => ({
      getCardsCollection: jest.fn(() => {
        throw new Error("sandbox should not load cards from database");
      }),
      getLinkedAccountsCollection: jest.fn(() => {
        throw new Error("sandbox should not load linked accounts from database");
      }),
      getBetaWalletsCollection: jest.fn(() => {
        throw new Error("sandbox should not load beta wallets from database");
      }),
      getUserBenefitStatesCollection: jest.fn(() => {
        throw new Error("sandbox should not load benefit states from database");
      }),
    }));

    const { decidePayment } = await import("../src/services/paymentDecisionService");
    const decision = await decidePayment({
      userId: "sandbox-user",
      merchant: "Amazon",
      category: "online_retail",
      amount: 142.83,
      manualCardSlugs: ["capital-one-venture"],
      restrictToWallet: true,
      purchaseContext: {
        surface: "backend",
        amount: 142.83,
        currency: "USD",
        checkoutDetected: true,
        checkoutStage: "payment",
      },
    });

    expect(decision.recommendedCard?.card.slug).toBe("capital-one-venture");
    expect(decision.wallet.cardSlugs).toEqual(["capital-one-venture"]);
  });
});
