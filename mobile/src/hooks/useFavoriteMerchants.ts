import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, setJson } from "@/storage/secureStorage";
import { storageKeys } from "@/storage/keys";
import type { FavoriteMerchant } from "@/types/location";
import type { MerchantSuggestion } from "@/types/rewardly";

const favoriteKey = ["favoriteMerchants"];

export function useFavoriteMerchants() {
  return useQuery({
    queryKey: favoriteKey,
    queryFn: () => getJson<FavoriteMerchant[]>(storageKeys.favoriteMerchants, [])
  });
}

export function useFavoriteMerchantActions() {
  const queryClient = useQueryClient();

  const saveFavorites = useMutation({
    mutationFn: async (favorites: FavoriteMerchant[]) => {
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
