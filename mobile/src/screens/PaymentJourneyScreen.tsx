import { useMemo, useState } from "react";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { EmptyState, LoadingState } from "@/components/StateViews";
import { Body, Heading, Title } from "@/components/Text";
import { usePaymentJourney } from "@/hooks/usePaymentJourney";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import type { PaymentJourneyEntry, PaymentJourneyFilter } from "@/types/paymentJourney";
import {
  calculateMonthlyProgress,
  filterJourneyEntries,
  reinforcementMessage
} from "@/utils/paymentJourney";
import { formatConfidence, formatCurrency, shortDate } from "@/utils/format";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Journey">,
  NativeStackScreenProps<RootStackParamList>
>;

const filters: Array<{ label: string; value: PaymentJourneyFilter }> = [
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "All Time", value: "all" }
];

export function PaymentJourneyScreen({ navigation }: Props) {
  const journey = usePaymentJourney();
  const [filter, setFilter] = useState<PaymentJourneyFilter>("month");
  const visibleEntries = useMemo(
    () => filterJourneyEntries(journey.data || [], filter),
    [filter, journey.data]
  );
  const progress = useMemo(
    () => calculateMonthlyProgress(journey.data || []),
    [journey.data]
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 18 }}
      refreshControl={
        <RefreshControl
          refreshing={journey.isRefetching}
          onRefresh={journey.refetch}
          tintColor={colors.cyan}
        />
      }
    >
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "900" }}>
          PAYMENT JOURNEY
        </Text>
        <Title>Your smart spending timeline.</Title>
        <Body>
          Completed Smart Pay decisions become a history of better payment choices.
        </Body>
      </View>

      <MonthlyProgressCard progress={progress} />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {filters.map((item) => (
          <Pressable
            key={item.value}
            accessibilityRole="button"
            accessibilityLabel={`Filter ${item.label}`}
            onPress={() => setFilter(item.value)}
            style={{
              backgroundColor: filter === item.value ? colors.cyan : colors.card,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 10
            }}
          >
            <Text
              style={{
                color: filter === item.value ? colors.ink : colors.text,
                fontWeight: "900"
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {journey.isLoading ? (
        <LoadingState label="Loading your payment journey..." />
      ) : visibleEntries.length ? (
        <View style={{ gap: 12 }}>
          {visibleEntries.map((entry) => (
            <TimelineCard
              key={entry.paymentId}
              entry={entry}
              onPress={() =>
                navigation.navigate("PaymentDetail", { paymentId: entry.paymentId })
              }
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="No completed payments yet."
          body="Complete a Smart Pay recommendation and it will appear here."
        />
      )}
    </ScrollView>
  );
}

function MonthlyProgressCard({
  progress
}: {
  progress: ReturnType<typeof calculateMonthlyProgress>;
}) {
  return (
    <Card style={{ borderRadius: 28, borderColor: "rgba(56, 189, 248, 0.35)" }}>
      <View style={{ gap: 14 }}>
        <Heading>Monthly Progress</Heading>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Metric label="Smart Payments" value={String(progress.smartPayments)} />
          <Metric label="Estimated Rewards" value={formatCurrency(progress.estimatedRewards)} />
          <Metric
            label="Avg Confidence"
            value={
              progress.averageConfidence === null
                ? "No data"
                : formatConfidence(progress.averageConfidence)
            }
          />
          <Metric label="Best Merchant" value={progress.bestMerchant || "No data"} />
          <Metric label="Most Used Card" value={progress.mostUsedCard || "No data"} />
        </View>
      </View>
    </Card>
  );
}

function TimelineCard({
  entry,
  onPress
}: {
  entry: PaymentJourneyEntry;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Heading>{entry.merchant}</Heading>
              <Body>{shortDate(entry.completionTimestamp)}</Body>
            </View>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
              {formatCurrency(entry.purchaseAmount)}
            </Text>
          </View>
          <Body>{entry.selectedCard}</Body>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Metric label="Estimated Rewards" value={formatCurrency(entry.estimatedRewardValue)} />
            <Metric label="Outcome" value="Smart Decision" />
          </View>
          <Body>{reinforcementMessage(entry)}</Body>
        </View>
      </Card>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 132,
        backgroundColor: colors.ink,
        borderRadius: 16,
        padding: 12,
        gap: 4
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
        {value}
      </Text>
    </View>
  );
}
