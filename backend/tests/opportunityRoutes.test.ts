import router from "../src/routes/opportunityRoutes";

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

describe("opportunityRoutes", () => {
  test("GET /opportunities lists detected opportunities", async () => {
    const res = await invokeRoute("GET", "/opportunities?userId=devUser");

    expect(res.statusCode).toBe(200);
    expect(res.body.opportunities.length).toBeGreaterThan(0);
    expect(res.body.opportunities[0]).toEqual(
      expect.objectContaining({
        userId: "devUser",
        opportunityId: expect.any(String),
      }),
    );
  });

  test("GET /opportunities/timeline returns chronological timeline", async () => {
    const res = await invokeRoute("GET", "/opportunities/timeline?userId=devUser");

    expect(res.statusCode).toBe(200);
    expect(res.body.timeline.length).toBeGreaterThan(0);
    expect(res.body.timeline.map((item: any) => item.date)).toEqual(
      [...res.body.timeline.map((item: any) => item.date)].sort(),
    );
  });

  test("POST /opportunities/simulate returns deterministic simulation", async () => {
    const res = await invokeRoute("POST", "/opportunities/simulate", {
      userId: "devUser",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.simulation).toEqual(
      expect.objectContaining({
        opportunityId: expect.any(String),
        deterministicHash: expect.any(String),
      }),
    );
  });

  test("GET /opportunities/report returns report totals and insights", async () => {
    const res = await invokeRoute("GET", "/opportunities/report?userId=devUser");

    expect(res.statusCode).toBe(200);
    expect(res.body.report).toEqual(
      expect.objectContaining({
        userId: "devUser",
        totals: expect.objectContaining({
          activeCount: expect.any(Number),
        }),
      }),
    );
    expect(res.body.report.insights.length).toBeGreaterThan(0);
  });
});
