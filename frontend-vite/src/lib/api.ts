// frontend-vite/src/lib/api.ts
export const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://localhost:5001";
