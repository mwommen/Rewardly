import axios from "axios";
import { apiBaseUrl } from "@/config/env";

export const rewardlyApi = axios.create({
  baseURL: apiBaseUrl(),
  timeout: 4500,
  headers: {
    "Content-Type": "application/json"
  }
});

export function readableApiError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error?.message;
    if (typeof message === "string" && message.trim()) return message;
    if (error.code === "ECONNABORTED") return "Rewardly took too long to respond.";
    return "Rewardly could not check your wallet right now.";
  }
  return "Something went wrong. Please try again.";
}
