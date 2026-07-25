// frontend-vite/src/lib/api.ts
const rawApiBase =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.VITE_APP_ENV === "production" ? "" : "http://localhost:5001");

if (import.meta.env.VITE_APP_ENV === "production" && !rawApiBase) {
  throw new Error("VITE_API_BASE_URL is required for production builds.");
}

export const API_BASE = rawApiBase.replace(/\/$/, "");
