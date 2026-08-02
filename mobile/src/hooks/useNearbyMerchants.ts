import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { getNearbyMerchantProvider } from "@/providers/nearbyMerchantProvider";

export function useNearbyMerchants(enabled: boolean) {
  return useQuery({
    queryKey: ["nearbyMerchants"],
    enabled,
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      const provider = getNearbyMerchantProvider();
      return provider.findNearbyMerchants({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude
      });
    }
  });
}
