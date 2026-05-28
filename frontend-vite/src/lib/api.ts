// frontend-vite/src/lib/api.ts
const rawApiBase =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:5001";

export const API_BASE = rawApiBase.replace(/\/$/, "");
