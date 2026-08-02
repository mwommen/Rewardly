import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState, LoadingState } from "@/components/StateViews";
import { Body, Heading, Title } from "@/components/Text";
import { usePaymentJourney } from "@/hooks/usePaymentJourney";
import { useWalletCoach, useWalletCoachActions } from "@/hooks/useWalletCoach";
import type { RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import { formatCurrency, shortDate } from "@/utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "OpportunityDetail">;

export function OpportunityDetailScreen({ navigation, route }: Props) {
  const coach = useWalletCoach();
  const journey = usePaymentJourney();
  const coachActions = useWalletCoachActions();
  const opportunity = coach.data.opportunities.find(
    (item) => item.opportunityId === route.params.opportunityId
  );
  const supportingPurchases = (journey.data || []).filter((entry) =>
    opportunity?.supportingPaymentIds.includes(entry.paymentId)
  );

  if (coach.isLoading) {
    return <LoadingState label="Loading opportunity..." />;
  }

  if (!opportunity) {
    return (
      <EmptyState
        title="Opportunity no longer available."
        body="Rewardly recalculates coaching as your journey changes."
      />
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 18 }}
    >
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "900" }}>
          OPPORTUNITY
        </Text>
        <Title>{opportunity.title}</Title>
        <Body>{opportunity.explanation}</Body>
      </View>

      <Card>
        <View style={{ gap: 8 }}>
          <Heading>Why Rewardly surfaced this</Heading>
          <Body>{opportunity.whySurfaced}</Body>
        </View>
      </Card>

      <Card>
        <View style={{ gap: 8 }}>
          <Heading>Suggested improvement</Heading>
          <Body>{opportunity.suggestedAction}</Body>
        </View>
      </Card>

      <Card>
        <View style={{ gap: 8 }}>
          <Heading>Estimated additional annual value</Heading>
          <Body>
            {opportunity.estimatedAnnualValue === null
              ? "Not enough completed purchase data yet. Rewardly will only estimate when the pattern is supported."
              : formatCurrency(opportunity.estimatedAnnualValue)}
          </Body>
        </View>
      </Card>

      {supportingPurchases.length ? (
        <View style={{ gap: 12 }}>
          <Heading>Supporting purchases</Heading>
          {supportingPurchases.map((entry) => (
            <Card key={entry.paymentId}>
              <View style={{ gap: 8 }}>
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
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No supporting purchases yet."
          body="This opportunity is based on your wallet setup or missing journey history."
        />
      )}

      <Button
        title="Dismiss opportunity"
        variant="secondary"
        loading={coachActions.isSaving}
        onPress={() => {
          coachActions.dismissOpportunity(opportunity.opportunityId);
          navigation.goBack();
        }}
      />
    </ScrollView>
  );
}
