import {
  runtimeEnvironment,
  validateRuntimeEnvironment,
} from "../src/config/environment";

describe("runtime environment validation", () => {
  test("allows development without production-only variables", () => {
    expect(
      validateRuntimeEnvironment({
        NODE_ENV: "development",
        PORT: "5001",
      } as NodeJS.ProcessEnv),
    ).toEqual(
      expect.objectContaining({
        isProduction: false,
        port: 5001,
        sandboxMode: false,
      }),
    );
  });

  test("fails production startup with clear missing variable errors", () => {
    expect(() =>
      validateRuntimeEnvironment({
        NODE_ENV: "production",
        PORT: "5001",
      } as NodeJS.ProcessEnv),
    ).toThrow(
      /Missing required production environment variables: MONGO_URI, FRONTEND_ORIGIN, EXTENSION_ORIGIN/,
    );
  });

  test("rejects unsafe production development values", () => {
    expect(() =>
      validateRuntimeEnvironment({
        NODE_ENV: "production",
        PORT: "5001",
        MONGO_URI: "mongodb://localhost:27017",
        FRONTEND_ORIGIN: "https://app.rewardly.com",
        EXTENSION_ORIGIN: "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      } as NodeJS.ProcessEnv),
    ).toThrow(/unsafe development values: MONGO_URI/);
  });

  test("sandbox mode can run without external production variables", () => {
    expect(
      runtimeEnvironment({
        NODE_ENV: "production",
        REWARDLY_SANDBOX_MODE: "true",
      } as NodeJS.ProcessEnv),
    ).toEqual(
      expect.objectContaining({
        isProduction: true,
        sandboxMode: true,
        port: 5001,
      }),
    );
    expect(() =>
      validateRuntimeEnvironment({
        NODE_ENV: "production",
        REWARDLY_SANDBOX_MODE: "true",
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });
});
