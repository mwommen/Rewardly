import type {
  Coordinates,
  NearbyMerchant,
  NearbyMerchantProvider
} from "@/types/location";
import { merchantSuggestions } from "@/utils/merchants";

const mockLocations = [
  {
    merchant: merchantSuggestions.find((merchant) => merchant.name === "Target")!,
    latitude: 44.9778,
    longitude: -93.265,
    accuracy: "mock" as const
  },
  {
    merchant: merchantSuggestions.find((merchant) => merchant.name === "Starbucks")!,
    latitude: 44.9787,
    longitude: -93.2639,
    accuracy: "mock" as const
  },
  {
    merchant: merchantSuggestions.find((merchant) => merchant.name === "Best Buy")!,
    latitude: 44.9759,
    longitude: -93.271,
    accuracy: "mock" as const
  },
  {
    merchant: merchantSuggestions.find((merchant) => merchant.name === "Costco")!,
    latitude: 44.971,
    longitude: -93.279,
    accuracy: "mock" as const
  }
].filter((item) => item.merchant);

export const mockNearbyMerchantProvider: NearbyMerchantProvider = {
  name: "mock-nearby-provider",
  async findNearbyMerchants(location: Coordinates) {
    return mockLocations
      .map<NearbyMerchant>((item) => ({
        ...item.merchant,
        distanceMiles: distanceMiles(location, item),
        accuracy: item.accuracy,
        provider: "mock"
      }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, 5);
  }
};

export function getNearbyMerchantProvider(): NearbyMerchantProvider {
  return mockNearbyMerchantProvider;
}

function distanceMiles(from: Coordinates, to: Coordinates) {
  const earthRadiusMiles = 3958.8;
  const dLat = degreesToRadians(to.latitude - from.latitude);
  const dLon = degreesToRadians(to.longitude - from.longitude);
  const lat1 = degreesToRadians(from.latitude);
  const lat2 = degreesToRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}
