import { useEffect } from "react";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { Body, Heading, Title } from "@/components/Text";
import { readableApiError } from "@/api/client";
import { useFavoriteMerchants } from "@/hooks/useFavoriteMerchants";
import { usePaymentDecision } from "@/hooks/usePaymentDecision";
import { useRecentPurchaseActions } from "@/hooks/useRecentPurchases";
import {
  useLastPurchaseAmount,
  useRecentMerchants,
  useSmartPayStateActions
} from "@/hooks/useSmartPayState";
import { useWallet } from "@/hooks/useWallet";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import type { MerchantSuggestion } from "@/types/rewardly";
import { formatConfidence, formatCurrency } from "@/utils/format";
import { merchantSuggestions } from "@/utils/merchants";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Simulator">,
  NativeStackScreenProps<RootStackParamList>
>;

type FormValues = {
  merchant: string;
  amount: string;
};

export function PurchaseSimulatorScreen({ navigation, route }: Props) {
  const wallet = useWallet();
  const decision = usePaymentDecision();
  const recentActions = useRecentPurchaseActions();
  const recentMerchants = useRecentMerchants();
  const favoriteMerchants = useFavoriteMerchants();
  const lastAmount = useLastPurchaseAmount();
  const smartPayActions = useSmartPayStateActions();
  const { control, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      merchant: route.params?.merchant?.name || "Target",
      amount: lastAmount.data || "127"
    }
  });

  useEffect(() => {
    if (route.params?.merchant?.name) {
      setValue("merchant", route.params.merchant.name);
    }
  }, [route.params?.merchant, setValue]);

  useEffect(() => {
    if (lastAmount.data) {
      setValue("amount", lastAmount.data);
    }
  }, [lastAmount.data, setValue]);

  const submit = handleSubmit(async (values) => {
    const amount = Number(values.amount);
    const merchantName = values.merchant.trim();
    const selectedMerchant = findMerchant(merchantName) || route.params?.merchant;
    const response = await decision.mutateAsync({
      merchant: {
        name: merchantName,
        category: selectedMerchant?.category,
        domain: selectedMerchant?.domain
      },
      purchase: {
        amount,
        currency: "USD"
      },
      wallet: {
        cards: (wallet.data || []).map((card) => ({ cardId: card.cardId }))
      }
    });

    smartPayActions.rememberAmount(values.amount);
    smartPayActions.rememberMerchant({
      name: merchantName,
      category: selectedMerchant?.category,
      domain: selectedMerchant?.domain
    });
    recentActions.addRecentPurchase({
      id: response.decisionId,
      merchant: merchantName,
      amount,
      recommendedCard: response.recommendedPaymentMethod?.displayName || "No card",
      estimatedValue: response.estimatedValue,
      createdAt: new Date().toISOString(),
      decision: response
    });
  });

  const merchant = watch("merchant");
  const amount = Number(watch("amount"));
  const estimateLabel = decision.data?.estimatedValue
    ? formatCurrency(decision.data.estimatedValue)
    : "Estimated after Rewardly checks your wallet";
  const rewardRate =
    decision.data?.estimatedValue && amount > 0
      ? `${((decision.data.estimatedValue / amount) * 100).toFixed(1)}% estimated value`
      : "Best verified value from your wallet";

  return (
    <Screen>
      <View style={{ gap: 22 }}>
        <View style={{ gap: 12, paddingTop: 8 }}>
          <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "900" }}>
            SMART PAY
          </Text>
          <Title style={{ fontSize: 36, lineHeight: 41 }}>
            Make the smartest payment decision.
          </Title>
          <Body>
            Tell Rewardly where you are paying. The API checks only your wallet and
            explains the best card in seconds.
          </Body>
        </View>

        <Card
          style={{
            borderRadius: 28,
            borderColor: colors.cyan,
            backgroundColor: colors.panel,
            shadowColor: colors.cyan,
            shadowOpacity: 0.18,
            shadowRadius: 22,
            elevation: 8
          }}
        >
          <View style={{ gap: 14 }}>
            <Controller
              name="merchant"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <TextInput
                  accessibilityLabel="Merchant"
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder="Where are you paying?"
                  placeholderTextColor={colors.muted}
                  style={inputStyle}
                />
              )}
            />
            <Controller
              name="amount"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <TextInput
                  accessibilityLabel="Purchase amount"
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder="Purchase amount"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.muted}
                  style={inputStyle}
                />
              )}
            />
            <Button
              title="Get recommendation"
              loading={decision.isPending}
              disabled={!wallet.data?.length}
              onPress={submit}
            />
            {!wallet.data?.length ? (
              <Body>Add cards or load demo mode before using Smart Pay.</Body>
            ) : (
              <Body>{wallet.data.length} cards ready in your wallet.</Body>
            )}
          </View>
        </Card>

        {favoriteMerchants.data?.length ? (
          <MerchantRows
            title="Favorites"
            merchants={favoriteMerchants.data}
            onSelect={(item) => {
              setValue("merchant", item.name);
              smartPayActions.rememberMerchant(item);
            }}
          />
        ) : null}

        <MerchantRows
          title="Suggested"
          merchants={prioritizeMerchants(favoriteMerchants.data || [], merchantSuggestions).slice(0, 6)}
          onSelect={(item) => {
            setValue("merchant", item.name);
            smartPayActions.rememberMerchant(item);
          }}
        />

        {recentMerchants.data?.length ? (
          <MerchantRows
            title="Recent"
            merchants={recentMerchants.data}
            onSelect={(item) => setValue("merchant", item.name)}
          />
        ) : null}

        {decision.isPending ? (
          <Card>
            <View style={{ gap: 12 }}>
              <ActivityIndicator color={colors.cyan} />
              <Heading>Checking your wallet...</Heading>
              <Body>Rewardly is comparing your owned cards through the API.</Body>
            </View>
          </Card>
        ) : null}

        {decision.error ? <Body>{readableApiError(decision.error)}</Body> : null}

        {decision.data ? (
          <Card style={{ borderRadius: 26 }}>
            <View style={{ gap: 14 }}>
              <Text style={{ color: colors.gold, fontSize: 12, fontWeight: "900" }}>
                RECOMMENDED
              </Text>
              <Title style={{ fontSize: 28 }}>
                {decision.data.recommendedPaymentMethod?.displayName || "No card found"}
              </Title>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Metric label="You'll get" value={estimateLabel} />
                <Metric label="Rate" value={rewardRate} />
              </View>
              <Body>{decision.data.explanation.summary || decision.data.reason}</Body>
              <Body>Confidence: {formatConfidence(decision.data.confidence)}</Body>
              <Button
                title="See why"
                onPress={() =>
                  navigation.navigate("RecommendationDetails", {
                    decision: decision.data!,
                    merchant,
                    amount
                  })
                }
              />
            </View>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

function MerchantRows({
  title,
  merchants,
  onSelect
}: {
  title: string;
  merchants: MerchantSuggestion[];
  onSelect: (merchant: MerchantSuggestion) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Heading>{title}</Heading>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {merchants.map((merchant) => (
          <Pressable
            key={`${title}-${merchant.name}`}
            accessibilityRole="button"
            accessibilityLabel={`Select ${merchant.name}`}
            onPress={() => onSelect(merchant)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.line : colors.card,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 10
            })}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>{merchant.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 135,
        backgroundColor: colors.ink,
        borderRadius: 18,
        padding: 14,
        gap: 4
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
        {value}
      </Text>
    </View>
  );
}

function findMerchant(name: string) {
  return merchantSuggestions.find(
    (merchant) => merchant.name.toLowerCase() === name.trim().toLowerCase()
  );
}

function prioritizeMerchants(
  favorites: MerchantSuggestion[],
  merchants: MerchantSuggestion[]
) {
  return [...favorites, ...merchants].filter(
    (merchant, index, list) =>
      list.findIndex(
        (item) => item.name.trim().toLowerCase() === merchant.name.trim().toLowerCase()
      ) === index
  );
}

const inputStyle = {
  color: colors.text,
  backgroundColor: colors.ink,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: 18,
  paddingHorizontal: 16,
  paddingVertical: 15,
  fontSize: 17
};
