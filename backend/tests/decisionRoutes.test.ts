jest.mock("../src/services/paymentDecisionService", () => ({
  decidePayment: jest.fn(),
}));

import router from "../src/routes/decisionRoutes";
import { decidePayment } from "../src/services/paymentDecisionService";

const mockedDecidePayment = decidePayment as jest.MockedFunction<
  typeof decidePayment
>;

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

describe("decisionRoutes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /decisions/payment invokes PaymentDecisionService", async () => {
    mockedDecidePayment.mockResolvedValueOnce({
      recommendedCard: {
        card: {
          slug: "amex-platinum",
          name: "The Platinum Card® from American Express",
        },
      },
      wallet: {
        userId: "manualTestUser",
        cardSlugs: ["amex-platinum"],
      },
      merchant: { name: "Amazon" },
    } as any);

    const res = await invokeRoute("POST", "/decisions/payment", {
      userId: "manualTestUser",
      merchant: "Amazon",
      hostname: "www.amazon.com",
      manualCardSlugs: ["amex-platinum"],
      restrictToWallet: true,
    });

    expect(res.statusCode).toBe(200);
    expect(mockedDecidePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "manualTestUser",
        merchant: "Amazon",
        hostname: "www.amazon.com",
        manualCardSlugs: ["amex-platinum"],
        restrictToWallet: true,
      }),
    );
    expect(res.body.decision.recommendedCard.card.slug).toBe("amex-platinum");
  });

  test("POST /decisions/payment rejects missing checkout context with 400", async () => {
    const res = await invokeRoute("POST", "/decisions/payment", {
      userId: "manualTestUser",
      manualCardSlugs: ["amex-platinum"],
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/payment decision requires/i);
    expect(mockedDecidePayment).not.toHaveBeenCalled();
  });
});
