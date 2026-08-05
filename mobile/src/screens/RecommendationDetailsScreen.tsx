import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";
import { fetchDecisionTrust } from "@/api/rewardly";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { Body, Heading, Title } from "@/components/Text";
import { usePaymentJourneyActions } from "@/hooks/usePaymentJourney";
import type { RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import { reinforcementMessage } from "@/utils/paymentJourney";
import { formatConfidence, formatCurrency } from "@/utils/format";
import type { DecisionTrustRecord } from "@/types/rewardly";

type Props = NativeStackScreenProps<RootStackParamList, "RecommendationDetails">;
type TrustEvidence = DecisionTrustRecord["evidence"][number];
type TrustAlternative = DecisionTrustRecord["alternatives"][number];
type TrustWarning = DecisionTrustRecord["warnings"][number];

export function RecommendationDetailsScreen({ navigation, route }: Props) {
  const { decision, merchant, amount } = route.params;
  const journeyActions = usePaymentJourneyActions();
  const [completedMessage, setCompletedMessage] = useState<string | null>(null);
  const trust = useQuery({
    queryKey: ["decisionTrust", decision.decisionId],
    queryFn: () => fetchDecisionTrust(decision.decisionId),
    enabled: Boolean(decision.trust?.trustRecordId),
    staleTime: 1000 * 60 * 5,
  });
  const estimatedRate =
    decision.estimatedValue && amount > 0
      ? `${((decision.estimatedValue / amount) * 100).toFixed(1)}% estimated value`
      : "Best available rate from your wallet";

  return (
    <Screen>
      <View style={{ gap: 18 }}>
        <Card
          style={{
            borderRadius: 30,
            backgroundColor: colors.panel,
            borderColor: "rgba(56, 189, 248, 0.4)",
          }}
        >
          <View style={{ gap: 16 }}>
            <Text style={{ color: colors.gold, fontSize: 12, fontWeight: "900" }}>
              USE THIS CARD
            </Text>
            <Title style={{ fontSize: 34, lineHeight: 39 }}>
              {decision.recommendedPaymentMethod?.displayName || "No card found"}
            </Title>
            <Body>
              {merchant} - {formatCurrency(amount)}
            </Body>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <Pill
                label="Estimated value"
                value={formatCurrency(decision.estimatedValue)}
              />
              <Pill label="Reward rate" value={estimatedRate} />
              <Pill label="Confidence" value={formatConfidence(decision.confidence)} />
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ gap: 10 }}>
            <Heading>Why Rewardly chose it</Heading>
            <Body>
              {trust.data?.explanation.summary ||
                decision.explanation.summary ||
                decision.reason}
            </Body>
            {trust.data?.explanation.primaryReason.message ? (
              <Body>{trust.data.explanation.primaryReason.message}</Body>
            ) : null}
          </View>
        </Card>

        <Card>
          <View style={{ gap: 10 }}>
            <Heading>Evidence</Heading>
            {trust.data?.evidence.length ? (
              trust.data.evidence.slice(0, 4).map((item: TrustEvidence) => (
                <View key={item.evidenceId} style={{ flexDirection: "row", gap: 10 }}>
                  <Text style={{ color: colors.cyan, fontWeight: "900" }}>-</Text>
                  <Body style={{ flex: 1 }}>{item.statement}</Body>
                </View>
              ))
            ) : decision.explanation.factors.length ? (
              decision.explanation.factors.map((factor) => (
                <View key={factor} style={{ flexDirection: "row", gap: 10 }}>
                  <Text style={{ color: colors.cyan, fontWeight: "900" }}>-</Text>
                  <Body style={{ flex: 1 }}>{factor}</Body>
                </View>
              ))
            ) : (
              <Body>
                Rewardly compared this purchase against the cards currently in your wallet.
              </Body>
            )}
          </View>
        </Card>

        {trust.data?.alternatives.length ? (
          <Card>
            <View style={{ gap: 10 }}>
              <Heading>Alternatives considered</Heading>
              {trust.data.alternatives.slice(0, 2).map((alternative: TrustAlternative) => (
                <View key={alternative.paymentMethodId} style={{ gap: 3 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
                    {alternative.displayName}
                  </Text>
                  <Body>{alternative.reasonNotSelected.message}</Body>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {trust.data?.warnings.length ? (
          <Card style={{ borderColor: "rgba(251, 191, 36, 0.38)" }}>
            <View style={{ gap: 10 }}>
              <Heading>Good to know</Heading>
              {trust.data.warnings.slice(0, 2).map((warning: TrustWarning) => (
                <Body key={warning.code}>{warning.message}</Body>
              ))}
            </View>
          </Card>
        ) : null}

        <Card style={{ borderColor: "rgba(52, 211, 153, 0.38)" }}>
          <View style={{ gap: 12 }}>
            <Heading>Ready to pay?</Heading>
            <Body>
              Mark this as completed after you use the recommended card. Rewardly will add
              it to your Payment Journey.
            </Body>
            <Button
              title="Complete Purchase"
              onPress={() => {
                const entry = journeyActions.completePurchase({
                  decision,
                  merchant,
                  amount,
                  selectedCard: decision.recommendedPaymentMethod?.displayName,
                });
                setCompletedMessage(reinforcementMessage(entry));
                navigation.navigate("PaymentDetail", { paymentId: entry.paymentId });
              }}
            />
            {completedMessage ? <Body>{completedMessage}</Body> : null}
          </View>
        </Card>

        <Card style={{ backgroundColor: colors.ink }}>
          <View style={{ gap: 8 }}>
            <Heading>Details</Heading>
            <Body>
              This recommendation came from the Rewardly API. The mobile app does not run or
              duplicate recommendation logic.
            </Body>
            <Body>Decision ID: {decision.decisionId}</Body>
            {trust.data ? (
              <>
                <Body>Trust Record: {trust.data.trustRecordId}</Body>
                <Body>
                  {trust.data.confidence.level.toUpperCase()} confidence - commercial bias
                  applied: {trust.data.provenance.commercialBiasApplied ? "yes" : "no"}
                </Body>
              </>
            ) : decision.trust ? (
              <Body>Trust Record: {decision.trust.trustRecordId}</Body>
            ) : null}
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 135,
        backgroundColor: colors.ink,
        borderRadius: 18,
        padding: 14,
        gap: 4,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}
