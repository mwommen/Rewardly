import axios from "axios";
import { clearStoredAuthSession, currentAuthSession, setStoredAuthSession } from "@/api/authSession";
import { apiBaseUrl } from "@/config/env";

export const rewardlyApi = axios.create({
  baseURL: apiBaseUrl(),
  timeout: 4500,
  headers: {
    "Content-Type": "application/json"
  }
});

rewardlyApi.interceptors.request.use((config) => {
  const token = currentAuthSession()?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

rewardlyApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const code = error.response?.data?.error?.code;
    const session = currentAuthSession();
    if (
      error.response?.status === 401 &&
      !original.__rewardlyRetried &&
      session?.refreshToken &&
      (code === "SESSION_EXPIRED" || code === "INVALID_SESSION")
    ) {
      original.__rewardlyRetried = true;
      try {
        const refreshed = await rewardlyApi.post("/api/v1/auth/refresh", {
          refreshToken: session.refreshToken
        });
        await setStoredAuthSession(refreshed.data);
        original.headers = {
          ...(original.headers || {}),
          Authorization: `Bearer ${refreshed.data.accessToken}`
        };
        return rewardlyApi(original);
      } catch {
        await clearStoredAuthSession();
      }
    }
    return Promise.reject(error);
  }
);

export function readableApiError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error?.message;
    if (typeof message === "string" && message.trim()) return message;
    if (error.code === "ECONNABORTED") return "Rewardly took too long to respond.";
    return "Rewardly could not check your wallet right now.";
  }
  return "Something went wrong. Please try again.";
}
