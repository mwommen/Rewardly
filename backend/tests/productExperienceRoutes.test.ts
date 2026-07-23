import router from "../src/routes/productExperienceRoutes";

async function invokeRoute(method: string, url: string, body?: any) {
  const parsed = new URL(`http://localhost${url}`);
  const req: any = {
    method,
    url,
    originalUrl: url,
    path: parsed.pathname,
    headers: {},
    query: Object.fromEntries(parsed.searchParams.entries()),
    body: body || {},
    params: {},
  };
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  await new Promise<void>((resolve, reject) => {
    (router as any).handle(req, res, (err: unknown) =>
      err ? reject(err) : resolve(),
    );
    setImmediate(resolve);
  });

  return res;
}

describe("productExperienceRoutes", () => {
  test("POST /experience/presentation returns UI-ready recommendation presentation", async () => {
    const res = await invokeRoute("POST", "/experience/presentation", {
      decision: {
        recommendedCard: {
          card: { slug: "amex-gold", name: "American Express Gold Card" },
          primaryReason: {
            label: "Best rewards",
            detail: "4x rewards at restaurants",
            kind: "reward",
          },
          unlockedBenefits: [],
        },
        primaryReason: {
          label: "Best rewards",
          detail: "4x rewards at restaurants",
          kind: "reward",
        },
        rewardEstimate: {
          label: "4x rewards",
          effectiveRate: 4,
          estimatedValueUSD: 6,
        },
        unlockedBenefits: [],
        confidence: { label: "high", score: 0.9 },
        recommendationSummary: "Use Amex Gold.",
        merchant: { name: "DoorDash" },
        wallet: {
          userId: "devUser",
          source: "manual",
          cardSlugs: ["amex-gold"],
        },
        generatedAt: "2026-07-22T00:00:00.000Z",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.presentation).toEqual(
      expect.objectContaining({
        state: "recommendation_ready",
        recommendedCard: expect.objectContaining({ slug: "amex-gold" }),
      }),
    );
    expect(res.body.lifecycle.stage).toBe("presentation_generated");
  });

  test("POST /experience/feedback returns structured feedback and analytics", async () => {
    const res = await invokeRoute("POST", "/experience/feedback", {
      type: "recommendation_dismissed",
      userId: "devUser",
      installationId: "install-123",
      presentationId: "presentation-123",
      merchantName: "Amazon",
      cardSlug: "amex-platinum",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.feedback).toEqual(
      expect.objectContaining({
        type: "recommendation_dismissed",
        merchantName: "Amazon",
      }),
    );
    expect(res.body.analytics.type).toBe("dismissed");
  });

  test("GET /experience/dashboard/:userId returns future dashboard data model", async () => {
    const res = await invokeRoute("GET", "/experience/dashboard/devUser");

    expect(res.statusCode).toBe(200);
    expect(res.body.dashboard).toEqual(
      expect.objectContaining({
        userId: "devUser",
        currentWallet: { cardSlugs: [], cardCount: 0 },
      }),
    );
  });
});
