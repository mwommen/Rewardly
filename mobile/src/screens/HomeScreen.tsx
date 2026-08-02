import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { EmptyState } from "@/components/StateViews";
import { Body, Heading, Title } from "@/components/Text";
import {
  isFavoriteMerchant,
  useFavoriteMerchantActions,
  useFavoriteMerchants
} from "@/hooks/useFavoriteMerchants";
import {
  useLocationPermission,
  useLocationPermissionActions
} from "@/hooks/useLocationPermission";
import { useNearbyMerchants } from "@/hooks/useNearbyMerchants";
import { useRecentPurchases } from "@/hooks/useRecentPurchases";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import type { NearbyMerchant } from "@/types/location";
import { merchantSuggestions } from "@/utils/merchants";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Home">,
  NativeStackScreenProps<RootStackParamList>
>;

export function HomeScreen({ navigation }: Props) {
  const permission = useLocationPermission();
  const permissionActions = useLocationPermissionActions();
  const nearby = useNearbyMerchants(Boolean(permission.data?.granted));
  const favorites = useFavoriteMerchants();
  const favoriteActions = useFavoriteMerchantActions();
  const recent = useRecentPurchases();
  const firstNearby = nearby.data?.[0];
  const matchingRecent = recent.data?.find(
    (purchase) =>
      firstNearby &&
      purchase.merchant.trim().toLowerCase() === firstNearby.name.trim().toLowerCase()
  );

  return (
    <Screen>
      <View style={{ gap: 22 }}>
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "900" }}>
            CONTEXT AWARE
          </Text>
          <Title>Nearby Right Now</Title>
          <Body>
            Rewardly can suggest merchants near you while the app is open, then send
            you straight into Smart Pay.
          </Body>
        </View>

        {!permission.data?.granted ? (
          <Card style={{ borderRadius: 28 }}>
            <View style={{ gap: 14 }}>
              <Heading>Enable nearby suggestions</Heading>
              <Body>
                Allow location while using the app so Rewardly can show nearby
                merchants. Manual Smart Pay still works if you skip this.
              </Body>
              <Button
                title="Enable while using app"
                loading={permissionActions.isRequesting}
                onPress={() => permissionActions.requestWhenInUse()}
              />
              {permission.data?.canAskAgain === false ? (
                <Body>
                  Location access is off. You can enable it later from your device
                  settings.
                </Body>
              ) : null}
            </View>
          </Card>
        ) : nearby.isLoading ? (
          <Card>
            <View style={{ gap: 12, alignItems: "flex-start" }}>
              <ActivityIndicator color={colors.cyan} />
              <Heading>Finding nearby merchants...</Heading>
              <Body>Rewardly is checking nearby options with the mock provider.</Body>
            </View>
          </Card>
        ) : firstNearby ? (
          <ContextCard
            merchant={firstNearby}
            recommendedCard={matchingRecent?.recommendedCard || "Check in Smart Pay"}
            isFavorite={isFavoriteMerchant(favorites.data, firstNearby.name)}
            onFavorite={() => favoriteActions.toggleFavorite(firstNearby)}
            onPress={() => navigation.navigate("Simulator", { merchant: firstNearby })}
          />
        ) : (
          <EmptyState
            title="No nearby merchants found."
            body="Manual Smart Pay and search still work normally."
          />
        )}

        {nearby.data?.length ? (
          <View style={{ gap: 12 }}>
            <Heading>Nearby merchants</Heading>
            {nearby.data.slice(0, 4).map((merchant) => (
              <MerchantRow
                key={merchant.name}
                merchant={merchant}
                favorite={isFavoriteMerchant(favorites.data, merchant.name)}
                onFavorite={() => favoriteActions.toggleFavorite(merchant)}
                onPress={() => navigation.navigate("Simulator", { merchant })}
              />
            ))}
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          <Heading>Smart Pay shortcuts</Heading>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[...(favorites.data || []), ...merchantSuggestions.slice(0, 5)]
              .filter(
                (merchant, index, list) =>
                  list.findIndex(
                    (item) =>
                      item.name.trim().toLowerCase() === merchant.name.trim().toLowerCase()
                  ) === index
              )
              .slice(0, 8)
              .map((merchant) => (
                <Pressable
                  key={merchant.name}
                  accessibilityRole="button"
                  accessibilityLabel={`Open Smart Pay for ${merchant.name}`}
                  onPress={() => navigation.navigate("Simulator", { merchant })}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? colors.line : colors.card,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 10
                  })}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }}>
                    {merchant.name}
                  </Text>
                </Pressable>
              ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}

function ContextCard({
  merchant,
  recommendedCard,
  isFavorite,
  onFavorite,
  onPress
}: {
  merchant: NearbyMerchant;
  recommendedCard: string;
  isFavorite: boolean;
  onFavorite: () => void;
  onPress: () => void;
}) {
  return (
    <Card
      style={{
        borderRadius: 30,
        borderColor: "rgba(56, 189, 248, 0.45)",
        backgroundColor: colors.panel
      }}
    >
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "900" }}>
              NEARBY RIGHT NOW
            </Text>
            <Title style={{ fontSize: 32 }}>{merchant.name}</Title>
            <Body>{merchant.distanceMiles.toFixed(1)} mi - {merchant.accuracy} location</Body>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? "Remove favorite" : "Favorite merchant"}
            onPress={onFavorite}
            style={{ padding: 8 }}
          >
            <Text style={{ color: isFavorite ? colors.gold : colors.muted, fontWeight: "900" }}>
              {isFavorite ? "Saved" : "Save"}
            </Text>
          </Pressable>
        </View>
        <View style={{ gap: 4 }}>
          <Body>Recommended Card</Body>
          <Heading>{recommendedCard}</Heading>
        </View>
        <Button title="Tap to Smart Pay" onPress={onPress} />
      </View>
    </Card>
  );
}

function MerchantRow({
  merchant,
  favorite,
  onFavorite,
  onPress
}: {
  merchant: NearbyMerchant;
  favorite: boolean;
  onFavorite: () => void;
  onPress: () => void;
}) {
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open Smart Pay for ${merchant.name}`}
          onPress={onPress}
          style={{ flex: 1, gap: 4 }}
        >
          <Heading>{merchant.name}</Heading>
          <Body>{merchant.distanceMiles.toFixed(1)} mi - {merchant.category || "Merchant"}</Body>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? "Remove favorite" : "Favorite merchant"}
          onPress={onFavorite}
          style={{ padding: 8 }}
        >
          <Text style={{ color: favorite ? colors.gold : colors.muted, fontWeight: "900" }}>
            {favorite ? "Saved" : "Save"}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}
