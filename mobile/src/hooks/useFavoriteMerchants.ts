import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCloudPreferences, updateCloudPreferences } from "@/api/rewardly";
import { getJson, setJson } from "@/storage/secureStorage";
import { storageKeys } from "@/storage/keys";
import type { FavoriteMerchant } from "@/types/location";
import type { MerchantSuggestion } from "@/types/rewardly";

const favoriteKey = ["favoriteMerchants"];

export function useFavoriteMerchants() {
  return useQuery<FavoriteMerchant[]>({
    queryKey: favoriteKey,
    queryFn: async () => {
      try {
        const preferences = await fetchCloudPreferences();
        const favorites = Array.isArray(preferences.favoriteMerchants)
          ? preferences.favoriteMerchants
          : [];
        await setJson(storageKeys.favoriteMerchants, favorites);
        return favorites as FavoriteMerchant[];
      } catch {
        return getJson<FavoriteMerchant[]>(storageKeys.favoriteMerchants, []);
      }
    }
  });
}

export function useFavoriteMerchantActions() {
  const queryClient = useQueryClient();

  const saveFavorites = useMutation({
    mutationFn: async (favorites: FavoriteMerchant[]) => {
      try {
        await updateCloudPreferences({ favoriteMerchants: favorites });
      } catch {
        // Keep the local favorite list usable while offline; cloud sync retries on next change.
      }
      await setJson(storageKeys.favoriteMerchants, favorites);
      return favorites;
    },
    onSuccess: (favorites) => {
      queryClient.setQueryData(favoriteKey, favorites);
    }
  });

  return {
    toggleFavorite(merchant: MerchantSuggestion) {
      const favorites = queryClient.getQueryData<FavoriteMerchant[]>(favoriteKey) || [];
      const normalizedName = merchant.name.trim().toLowerCase();
      const exists = favorites.some(
        (favorite) => favorite.name.trim().toLowerCase() === normalizedName
      );
      if (exists) {
        saveFavorites.mutate(
          favorites.filter(
            (favorite) => favorite.name.trim().toLowerCase() !== normalizedName
          )
        );
        return;
      }
      saveFavorites.mutate([
        { ...merchant, favoritedAt: new Date().toISOString() },
        ...favorites
      ]);
    },
    clearFavorites() {
      saveFavorites.mutate([]);
    }
  };
}

export function isFavoriteMerchant(
  favorites: FavoriteMerchant[] | undefined,
  merchantName: string
) {
  return Boolean(
    favorites?.some(
      (favorite) => favorite.name.trim().toLowerCase() === merchantName.trim().toLowerCase()
    )
  );
}
