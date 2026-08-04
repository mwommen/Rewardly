import type { MerchantSuggestion } from "@/types/rewardly";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type NearbyMerchant = MerchantSuggestion & {
  distanceMiles: number;
  accuracy: "precise" | "approximate" | "mock";
  provider: string;
};

export type NearbyMerchantProvider = {
  name: string;
  findNearbyMerchants(location: Coordinates): Promise<NearbyMerchant[]>;
};

export type FavoriteMerchant = MerchantSuggestion & {
  favoritedAt: string;
};
