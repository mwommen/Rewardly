import router from "../src/routes/purchaseRoutes";

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

describe("purchaseRoutes", () => {
  test("POST /purchase/extract returns canonical purchase intelligence", async () => {
    const res = await invokeRoute("POST", "/purchase/extract", {
      merchantName: "Apple",
      hostname: "apple.com",
      subtotal: 799,
      tax: 65.92,
      total: 864.92,
      items: [{ name: "iPhone 16", price: 799, quantity: 1 }],
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.purchase).toEqual(
      expect.objectContaining({
        merchantId: "apple",
        total: 864.92,
      }),
    );
    expect(res.body.purchase.items[0].normalizedCategory).toBe("electronics");
  });

  test("POST /purchase/classify classifies a single item", async () => {
    const res = await invokeRoute("POST", "/purchase/classify", {
      name: "Amazon Gift Card",
      price: 50,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.item).toEqual(
      expect.objectContaining({
        normalizedCategory: "gift_card",
        exclusions: expect.arrayContaining(["gift_card"]),
      }),
    );
  });

  test("GET /purchase/report returns fixture report", async () => {
    const res = await invokeRoute("GET", "/purchase/report?fixture=mixed");

    expect(res.statusCode).toBe(200);
    expect(res.body.report.summary).toEqual(
      expect.objectContaining({
        itemCount: 4,
        hasGiftCard: true,
      }),
    );
  });
});
