jest.mock("../src/db", () => ({
  getAnalyticsCollection: jest.fn(),
}));

import router from "../src/routes/analyticsRoutes";
import { getAnalyticsCollection } from "../src/db";

const mockedGetAnalyticsCollection =
  getAnalyticsCollection as jest.MockedFunction<typeof getAnalyticsCollection>;

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

describe("analyticsRoutes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAnalyticsCollection.mockResolvedValue({
      insertOne: jest.fn().mockResolvedValue({ insertedId: "event-id" }),
      find: jest.fn(),
    } as any);
  });

  test("POST /event accepts anonymous extension installation events", async () => {
    const res = await invokeRoute("POST", "/event", {
      installationId: "install-123",
      source: "chrome_extension",
      event: "recommendation_displayed",
      metadata: {
        merchant: "Amazon",
        stage: "payment",
      },
    });

    expect(res.statusCode).toBe(200);
    const collection = await mockedGetAnalyticsCollection.mock.results[0].value;
    expect(collection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        installationId: "install-123",
        source: "chrome_extension",
        event: "recommendation_displayed",
        metadata: {
          merchant: "Amazon",
          stage: "payment",
        },
      }),
    );
  });

  test("POST /event rejects events without user or installation identity", async () => {
    const res = await invokeRoute("POST", "/event", {
      event: "recommendation_displayed",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/installation id/i);
    expect(mockedGetAnalyticsCollection).not.toHaveBeenCalled();
  });
});
