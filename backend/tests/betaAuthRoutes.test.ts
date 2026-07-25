jest.mock("../src/services/betaAuthService", () => ({
  activateBetaUser: jest.fn(),
  completeBetaOnboarding: jest.fn(),
  createExtensionConnection: jest.fn(),
  getBetaWallet: jest.fn(),
  redeemExtensionConnection: jest.fn(),
  setBetaWalletCards: jest.fn(),
  BetaValidationError: class BetaValidationError extends Error {
    status = 400;
  },
  authenticateBetaToken: jest.fn(),
  BetaAuthenticationError: class BetaAuthenticationError extends Error {
    status = 401;
  },
}));

import router from "../src/routes/betaAuthRoutes";
import {
  activateBetaUser,
  authenticateBetaToken,
  createExtensionConnection,
  getBetaWallet,
  redeemExtensionConnection,
  setBetaWalletCards,
} from "../src/services/betaAuthService";

const mockedActivate = activateBetaUser as jest.MockedFunction<typeof activateBetaUser>;
const mockedAuthenticate = authenticateBetaToken as jest.MockedFunction<typeof authenticateBetaToken>;
const mockedCreateConnection = createExtensionConnection as jest.MockedFunction<typeof createExtensionConnection>;
const mockedRedeemConnection = redeemExtensionConnection as jest.MockedFunction<typeof redeemExtensionConnection>;
const mockedGetWallet = getBetaWallet as jest.MockedFunction<typeof getBetaWallet>;
const mockedSetWalletCards = setBetaWalletCards as jest.MockedFunction<typeof setBetaWalletCards>;

async function invokeRoute(
  method: string,
  url: string,
  body?: any,
  headers: Record<string, string> = {},
) {
  const parsed = new URL(`http://localhost${url}`);
  const req: any = {
    method,
    url,
    originalUrl: url,
    path: parsed.pathname,
    headers,
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

describe("betaAuthRoutes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuthenticate.mockResolvedValue({
      userId: "beta-user-a",
      status: "active",
    });
  });

  test("POST /beta/activate returns a session token once", async () => {
    mockedActivate.mockResolvedValueOnce({
      sessionToken: "session-token",
      user: { userId: "beta-user-a", status: "active" },
    } as any);

    const res = await invokeRoute("POST", "/beta/activate", {
      activationToken: "invite-token",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.sessionToken).toBe("session-token");
    expect(mockedActivate).toHaveBeenCalledWith("invite-token");
  });

  test("GET /wallet uses the authenticated beta user", async () => {
    mockedGetWallet.mockResolvedValueOnce({
      userId: "beta-user-a",
      cardSlugs: ["amex-gold"],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const res = await invokeRoute(
      "GET",
      "/wallet",
      undefined,
      { authorization: "Bearer token-a" },
    );

    expect(res.statusCode).toBe(200);
    expect(mockedAuthenticate).toHaveBeenCalledWith("Bearer token-a");
    expect(mockedGetWallet).toHaveBeenCalledWith("beta-user-a");
    expect(res.body.wallet.cardSlugs).toEqual(["amex-gold"]);
  });

  test("PUT /wallet/cards ignores spoofed user identity", async () => {
    mockedSetWalletCards.mockResolvedValueOnce({
      userId: "beta-user-a",
      cardSlugs: ["capital-one-venture"],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const res = await invokeRoute(
      "PUT",
      "/wallet/cards",
      {
        userId: "beta-user-b",
        cardSlugs: ["capital-one-venture"],
      },
      { authorization: "Bearer token-a" },
    );

    expect(res.statusCode).toBe(200);
    expect(mockedSetWalletCards).toHaveBeenCalledWith("beta-user-a", [
      "capital-one-venture",
    ]);
  });

  test("POST /beta/extension-connections creates a short-lived code for the authenticated user", async () => {
    mockedCreateConnection.mockResolvedValueOnce({
      connectionCode: "one-time-code",
      expiresAt: new Date("2026-07-25T00:05:00.000Z"),
    });

    const res = await invokeRoute(
      "POST",
      "/beta/extension-connections",
      {},
      { authorization: "Bearer token-a" },
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.connectionCode).toBe("one-time-code");
    expect(mockedCreateConnection).toHaveBeenCalledWith("beta-user-a");
  });

  test("POST /beta/extension-connections/redeem returns an extension session", async () => {
    mockedRedeemConnection.mockResolvedValueOnce({
      sessionToken: "extension-session",
      user: { userId: "beta-user-a", status: "active" },
    } as any);

    const res = await invokeRoute("POST", "/beta/extension-connections/redeem", {
      connectionCode: "one-time-code",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.sessionToken).toBe("extension-session");
    expect(mockedRedeemConnection).toHaveBeenCalledWith("one-time-code");
  });
});
