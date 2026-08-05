import { useEffect, useMemo, useRef } from "react";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Animated, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { ContextCard } from "@/components/ContextCard";
import { Screen } from "@/components/Screen";
import { EmptyState, LoadingState } from "@/components/StateViews";
import { Body, Heading, Title } from "@/components/Text";
import {
  isFavoriteMerchant,
  useFavoriteMerchantActions,
  useFavoriteMerchants,
} from "@/hooks/useFavoriteMerchants";
import {
  useLocationPermission,
  useLocationPermissionActions,
} from "@/hooks/useLocationPermission";
import { useNearbyMerchants } from "@/hooks/useNearbyMerchants";
import { usePaymentJourney } from "@/hooks/usePaymentJourney";
import { usePlans } from "@/hooks/usePlans";
import { useWallet } from "@/hooks/useWallet";
import { useWalletCoach } from "@/hooks/useWalletCoach";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import type { FavoriteMerchant, NearbyMerchant } from "@/types/location";
import type { PersonalContextCard } from "@/types/personalIntelligence";
import { merchantSuggestions } from "@/utils/merchants";
import { createDailyBriefing } from "@/utils/dailyBriefing";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Home">,
  NativeStackScreenProps<RootStackParamList>
>;

export function HomeScreen({ navigation }: Props) {
  const wallet = useWallet();
  const coach = useWalletCoach();
  const journey = usePaymentJourney();
  const plans = usePlans();
  const permission = useLocationPermission();
  const permissionActions = useLocationPermissionActions();
  const nearby = useNearbyMerchants(Boolean(permission.data?.granted));
  const favorites = useFavoriteMerchants();
  const favoriteActions = useFavoriteMerchantActions();
  const fadeValue = useRef(new Animated.Value(0)).current;

  const briefing = useMemo(
    () =>
      createDailyBriefing({
        wallet: wallet.data || [],
        walletCoach: coach.data || null,
        paymentJourney: journey.data || [],
        plans: plans.data || [],
        nearbyMerchants: nearby.data || [],
        favoriteMerchants: favorites.data || [],
        locationGranted: Boolean(permission.data?.granted),
      }),
    [
      coach.data,
      favorites.data,
      journey.data,
      nearby.data,
      permission.data?.granted,
      plans.data,
      wallet.data,
    ],
  );
  const featuredCardId = briefing.cards[0]?.id;

  useEffect(() => {
    fadeValue.setValue(0);
    Animated.timing(fadeValue, {
      duration: 260,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [featuredCardId, fadeValue]);

  const isLoading =
    wallet.isLoading ||
    coach.isLoading ||
    journey.isLoading ||
    plans.isLoading ||
    favorites.isLoading ||
    permission.isLoading;

  return (
    <Screen>
      <View style={{ gap: 28 }}>
        <View style={{ gap: 10, paddingTop: 4 }}>
          <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "900" }}>TODAY</Text>
          <Title>{briefing.headline}</Title>
          <Body>{briefing.subheadline}</Body>
        </View>

        {isLoading ? (
          <LoadingState label="Preparing your payment briefing..." />
        ) : briefing.cards.length ? (
          <Animated.View style={{ gap: 14, opacity: fadeValue }}>
            {briefing.cards.map((card, index) => (
              <ContextCard
                key={card.id}
                card={card}
                featured={index === 0}
                onPrimaryPress={() => handleAction(card, card.primaryAction)}
                onSecondaryPress={
                  card.secondaryAction
                    ? () => handleAction(card, card.secondaryAction!)
                    : undefined
                }
              />
            ))}
          </Animated.View>
        ) : (
          <ContextCard
            card={briefing.emptyState}
            featured
            onPrimaryPress={() => handleAction(briefing.emptyState, "open_smart_pay")}
          />
        )}

        {!permission.data?.granted ? (
          <LocationPrompt
            canAskAgain={permission.data?.canAskAgain !== false}
            loading={permissionActions.isRequesting}
            onEnable={() => permissionActions.requestWhenInUse()}
          />
        ) : nearby.data?.length ? (
          <NearbyStrip
            merchants={nearby.data.slice(0, 3)}
            favorites={favorites.data || []}
            onFavorite={(merchant) => favoriteActions.toggleFavorite(merchant)}
            onPress={(merchant) => navigation.navigate("Simulator", { merchant })}
          />
        ) : null}

        <View style={{ gap: 12 }}>
          <Heading>Quick starts</Heading>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[...(favorites.data || []), ...merchantSuggestions.slice(0, 5)]
              .filter(
                (merchant, index, list) =>
                  list.findIndex(
                    (item) =>
                      item.name.trim().toLowerCase() === merchant.name.trim().toLowerCase(),
                  ) === index,
              )
              .slice(0, 6)
              .map((merchant) => (
                <Pressable
                  key={merchant.name}
                  accessibilityRole="button"
                  accessibilityLabel={`Open Smart Pay for ${merchant.name}`}
                  onPress={() => navigation.navigate("Simulator", { merchant })}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? colors.line : colors.card,
                    borderRadius: 999,
                    minHeight: 44,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
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

  function handleAction(
    card: PersonalContextCard,
    action: PersonalContextCard["primaryAction"],
  ) {
    if (action === "add_card") {
      navigation.navigate("AddCard");
      return;
    }
    if (action === "open_smart_pay_merchant" && card.metadata?.merchantName) {
      navigation.navigate("Simulator", {
        merchant: {
          name: card.metadata.merchantName,
          category: card.metadata.merchantCategory,
        },
      });
      return;
    }
    if (action === "open_plan" && card.metadata?.planId) {
      navigation.navigate("PlanDetail", { planId: card.metadata.planId });
      return;
    }
    if (action === "open_payment" && card.metadata?.paymentId) {
      navigation.navigate("PaymentDetail", { paymentId: card.metadata.paymentId });
      return;
    }
    if (action === "open_wallet_coach") {
      navigation.navigate("Coach");
      return;
    }
    if (action === "open_journey") {
      navigation.navigate("Journey");
      return;
    }
    if (action === "open_planning") {
      navigation.navigate("Planning");
      return;
    }
    navigation.navigate("Simulator");
  }
}

function LocationPrompt({
  canAskAgain,
  loading,
  onEnable,
}: {
  canAskAgain: boolean;
  loading: boolean;
  onEnable: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: "rgba(251, 191, 36, 0.08)",
        borderRadius: 24,
        gap: 12,
        padding: 18,
      }}
    >
      <EmptyState
        title="Want nearby Smart Pay?"
        body={
          canAskAgain
            ? "Allow location while using the app and Rewardly can surface nearby merchants automatically."
            : "Location is off. Manual Smart Pay still works, and you can enable location later in Settings."
        }
      />
      {canAskAgain ? (
        <Button
          title="Enable nearby suggestions"
          loading={loading}
          onPress={onEnable}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

function NearbyStrip({
  merchants,
  favorites,
  onFavorite,
  onPress,
}: {
  merchants: NearbyMerchant[];
  favorites: FavoriteMerchant[];
  onFavorite: (merchant: NearbyMerchant) => void;
  onPress: (merchant: NearbyMerchant) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Heading>Nearby</Heading>
      {merchants.map((merchant) => {
        const saved = isFavoriteMerchant(favorites, merchant.name);
        return (
          <View
            key={merchant.name}
            style={{
              alignItems: "center",
              backgroundColor: colors.panel,
              borderRadius: 22,
              flexDirection: "row",
              gap: 12,
              padding: 14,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open Smart Pay for ${merchant.name}`}
              onPress={() => onPress(merchant)}
              style={{ flex: 1, gap: 3 }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
                {merchant.name}
              </Text>
              <Body>
                {merchant.distanceMiles.toFixed(1)} mi - {merchant.category || "Merchant"}
              </Body>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saved ? "Remove favorite" : "Favorite merchant"}
              onPress={() => onFavorite(merchant)}
              style={{ padding: 8 }}
            >
              <Text
                style={{ color: saved ? colors.gold : colors.muted, fontWeight: "900" }}
              >
                {saved ? "Saved" : "Save"}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
