import { useQuery } from "@tanstack/react-query";
import { getJson, setJson } from "@/storage/secureStorage";
import { storageKeys } from "@/storage/keys";

export function useDevIdentity() {
  return useQuery({
    queryKey: ["devIdentity"],
    queryFn: async () => {
      const existing = await getJson<string | null>(storageKeys.userId, null);
      if (existing) return existing;
      const generated = `mobile-dev-${Date.now().toString(36)}`;
      await setJson(storageKeys.userId, generated);
      return generated;
    }
  });
}
