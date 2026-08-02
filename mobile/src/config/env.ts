import Constants from "expo-constants";

const expoExtra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;

export function apiBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_REWARDLY_API_BASE_URL ||
    expoExtra?.apiBaseUrl ||
    "http://localhost:5001"
  ).replace(/\/$/, "");
}
