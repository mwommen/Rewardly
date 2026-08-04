import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { EmptyState, LoadingState } from "@/components/StateViews";
import { Body, Heading, Title } from "@/components/Text";
import { useWalletCoach } from "@/hooks/useWalletCoach";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import type { SuccessMoment, WalletCoachOpportunity } from "@/types/walletCoach";
import { formatCurrency, shortDate } from "@/utils/format";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Coach">,
  NativeStackScreenProps<RootStackParamList>
>;

export function WalletCoachScreen({ navigation }: Props) {
  const coach = useWalletCoach();
  const snapshot = coach.data;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 18 }}
      refreshControl={
        <RefreshControl
          refreshing={coach.isRefetching}
          onRefresh={coach.refetch}
          tintColor={colors.cyan}
        />
      }
    >
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "900" }}>
          WALLET COACH
        </Text>
        <Title>Your wallet is learning from every purchase.</Title>
        <Body>
          Rewardly turns completed Smart Pay decisions into simple coaching you can
          act on.
        </Body>
      </View>

      {coach.isLoading ? (
        <LoadingState label="Building your coaching snapshot..." />
      ) : (
        <View style={{ gap: 18 }}>
          <ScoreCard score={snapshot.optimizationScore.score} trend={snapshot.optimizationScore.trend} explanation={snapshot.optimizationScore.explanation} />

          {snapshot.topOpportunity ? (
            <OpportunityCard
              opportunity={snapshot.topOpportunity}
              onPress={() =>
                navigation.navigate("OpportunityDetail", {
                  opportunityId: snapshot.topOpportunity?.opportunityId || ""
                })
              }
            />
          ) : (
            <EmptyState
              title="No urgent opportunity right now."
              body="Keep using Smart Pay and Rewardly will surface coaching as your journey grows."
            />
          )}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Metric
              label="Biggest Recent Win"
              value={
                snapshot.biggestRecentWin
                  ? formatCurrency(snapshot.biggestRecentWin.estimatedRewardValue)
                  : "No data"
              }
              detail={snapshot.biggestRecentWin?.merchant || "Complete a Smart Pay purchase"}
            />
            <Metric
              label="Most Improved"
              value={snapshot.mostImprovedCategory || "No data"}
              detail="Based on recent optimized decisions"
            />
          </View>

          <Card>
            <View style={{ gap: 12 }}>
              <Heading>This week</Heading>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <Metric
                  label="Purchases"
                  value={String(snapshot.weeklySummary.purchasesCompleted)}
                  compact
                />
                <Metric
                  label="Optimized"
                  value={String(snapshot.weeklySummary.optimizedPurchases)}
                  compact
                />
                <Metric
                  label="Rewards"
                  value={formatCurrency(snapshot.weeklySummary.estimatedRewards)}
                  compact
                />
                <Metric
                  label="Strongest"
                  value={snapshot.weeklySummary.strongestCategory || "No data"}
                  compact
                />
              </View>
            </View>
          </Card>

          <Card>
            <View style={{ gap: 8 }}>
              <Heading>Suggested action</Heading>
              <Body>{snapshot.suggestedAction}</Body>
            </View>
          </Card>

          {snapshot.successMoments.length ? (
            <View style={{ gap: 12 }}>
              <Heading>Progress moments</Heading>
              {snapshot.successMoments.map((moment) => (
                <SuccessMomentCard key={moment.momentId} moment={moment} />
              ))}
            </View>
          ) : null}

          {snapshot.opportunities.length > 1 ? (
            <View style={{ gap: 12 }}>
              <Heading>More opportunities</Heading>
              {snapshot.opportunities.slice(1).map((opportunity) => (
                <OpportunityCard
                  key={opportunity.opportunityId}
                  opportunity={opportunity}
                  compact
                  onPress={() =>
                    navigation.navigate("OpportunityDetail", {
                      opportunityId: opportunity.opportunityId
                    })
                  }
                />
              ))}
            </View>
          ) : null}

          <Body>Updated {shortDate(snapshot.generatedAt)}</Body>
        </View>
      )}
    </ScrollView>
  );
}

function ScoreCard({
  score,
  trend,
  explanation
}: {
  score: number;
  trend: number;
  explanation: string;
}) {
  const trendLabel = trend === 0 ? "No change" : `${trend > 0 ? "+" : ""}${trend} vs last month`;
  return (
    <Card
      style={{
        borderRadius: 30,
        borderColor: "rgba(56, 189, 248, 0.42)",
        backgroundColor: colors.panel
      }}
    >
      <View style={{ gap: 14 }}>
        <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "900" }}>
          OPTIMIZATION SCORE
        </Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 56, fontWeight: "900" }}>
            {score}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 20, fontWeight: "900", marginBottom: 10 }}>
            /100
          </Text>
        </View>
        <Body>{explanation}</Body>
        <Text style={{ color: trend >= 0 ? colors.green : colors.gold, fontWeight: "900" }}>
          {trendLabel}
        </Text>
      </View>
    </Card>
  );
}

function OpportunityCard({
  opportunity,
  onPress,
  compact = false
}: {
  opportunity: WalletCoachOpportunity;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={{ borderRadius: compact ? 22 : 28 }}>
        <View style={{ gap: compact ? 8 : 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ color: colors.gold, fontSize: 12, fontWeight: "900" }}>
              {opportunity.priority.toUpperCase()} PRIORITY
            </Text>
            <Text style={{ color: colors.cyan, fontWeight: "900" }}>Open</Text>
          </View>
          <Heading>{opportunity.title}</Heading>
          <Body>{opportunity.explanation}</Body>
          {!compact ? <Body>{opportunity.suggestedAction}</Body> : null}
        </View>
      </Card>
    </Pressable>
  );
}

function Metric({
  label,
  value,
  detail,
  compact = false
}: {
  label: string;
  value: string;
  detail?: string;
  compact?: boolean;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: compact ? 120 : 154,
        backgroundColor: colors.card,
        borderRadius: 18,
        padding: 14,
        gap: 5
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
        {value}
      </Text>
      {detail ? <Body style={{ fontSize: 13, lineHeight: 18 }}>{detail}</Body> : null}
    </View>
  );
}

function SuccessMomentCard({ moment }: { moment: SuccessMoment }) {
  return (
    <Card>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.green, fontSize: 12, fontWeight: "900" }}>
          PROGRESS
        </Text>
        <Heading>{moment.title}</Heading>
        <Body>{moment.explanation}</Body>
      </View>
    </Card>
  );
}
