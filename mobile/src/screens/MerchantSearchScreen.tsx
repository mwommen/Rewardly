import { useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { Body, Heading } from "@/components/Text";
import {
  isFavoriteMerchant,
  useFavoriteMerchantActions,
  useFavoriteMerchants
} from "@/hooks/useFavoriteMerchants";
import { useMerchantKnowledge, useMerchantSearch } from "@/hooks/useMerchantKnowledge";
import { useRecentMerchants, useSmartPayStateActions } from "@/hooks/useSmartPayState";
import type { RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import type { MerchantKnowledgeProfile, MerchantSearchResult, MerchantSuggestion } from "@/types/rewardly";
import { merchantSuggestions } from "@/utils/merchants";

type Props = NativeStackScreenProps<RootStackParamList, "MerchantSearch">;

export function MerchantSearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");
  const favorites = useFavoriteMerchants();
  const favoriteActions = useFavoriteMerchantActions();
  const recentMerchants = useRecentMerchants();
  const merchantKnowledge = useMerchantKnowledge();
  const merchantSearch = useMerchantSearch(query);
  const smartPay = useSmartPayStateActions();
  const merchants = useMemo(() => {
    const q = query.trim().toLowerCase();
    const backendMerchants =
      q && merchantSearch.data?.length
        ? merchantSearch.data.map(knowledgeToSuggestion)
        : merchantKnowledge.data?.merchants.map(knowledgeToSuggestion) || [];
    const combined = dedupeMerchants([
      ...(favorites.data || []),
      ...(recentMerchants.data || []),
      ...backendMerchants,
      ...merchantSuggestions
    ]);
    if (!q) return combined;
    return combined.filter((merchant) => {
      const searchText = [
        merchant.name,
        merchant.category,
        merchant.domain,
        merchant.knowledge?.brand,
        merchant.knowledge?.parentCompany,
        ...(merchant.knowledge?.aliases || []),
        ...(merchant.knowledge?.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchText.includes(q);
    });
  }, [favorites.data, merchantKnowledge.data, merchantSearch.data, query, recentMerchants.data]);

  const selectMerchant = (merchant: MerchantSuggestion) => {
    smartPay.rememberMerchant(merchant);
    navigation.navigate("MainTabs", {
      screen: "Simulator",
      params: { merchant }
    });
  };

  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <Body>Choose a merchant to jump back into Smart Pay.</Body>
        <TextInput
          accessibilityLabel="Search merchants"
          value={query}
          onChangeText={setQuery}
          placeholder="Search Target, Costco, Delta..."
          placeholderTextColor={colors.muted}
          style={{
            color: colors.text,
            backgroundColor: colors.card,
            borderRadius: 18,
            padding: 16,
            fontSize: 17
          }}
        />
        {merchantKnowledge.isLoading || merchantSearch.isFetching ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator color={colors.cyan} />
            <Body>Loading merchant intelligence...</Body>
          </View>
        ) : null}
        {merchants.map((merchant) => (
          <Card key={merchant.name}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Pressable onPress={() => selectMerchant(merchant)} style={{ flex: 1, gap: 5 }}>
                <Heading>{merchant.name}</Heading>
                <Body>{merchantSubtitle(merchant)}</Body>
                {merchant.knowledge?.loyaltyPrograms.length ? (
                  <Body>{merchant.knowledge.loyaltyPrograms.join(", ")}</Body>
                ) : null}
                <Text style={{ color: colors.cyan, fontWeight: "900" }}>Use in Smart Pay</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isFavoriteMerchant(favorites.data, merchant.name)
                    ? "Remove favorite"
                    : "Favorite merchant"
                }
                onPress={() => favoriteActions.toggleFavorite(merchant)}
                style={{ padding: 8 }}
              >
                <Text
                  style={{
                    color: isFavoriteMerchant(favorites.data, merchant.name)
                      ? colors.gold
                      : colors.muted,
                    fontWeight: "900"
                  }}
                >
                  {isFavoriteMerchant(favorites.data, merchant.name) ? "Saved" : "Save"}
                </Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

function knowledgeToSuggestion(
  merchant: MerchantKnowledgeProfile | MerchantSearchResult
): MerchantSuggestion {
  return {
    name: merchant.displayName,
    category: merchant.category,
    domain: merchant.domains[0],
    knowledge: merchant
  };
}

function merchantSubtitle(merchant: MerchantSuggestion) {
  if (!merchant.knowledge) return merchant.category || "Merchant";
  return [
    merchant.knowledge.subcategory || merchant.knowledge.category,
    merchant.knowledge.parentCompany ? `${merchant.knowledge.parentCompany} brand` : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

function dedupeMerchants(merchants: MerchantSuggestion[]) {
  const seen = new Set<string>();
  return merchants.filter((merchant) => {
    const key = merchant.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
