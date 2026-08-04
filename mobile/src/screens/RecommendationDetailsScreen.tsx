import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { Body, Heading, Title } from "@/components/Text";
import { usePaymentJourneyActions } from "@/hooks/usePaymentJourney";
import type { RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import { reinforcementMessage } from "@/utils/paymentJourney";
import { formatConfidence, formatCurrency } from "@/utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "RecommendationDetails">;

export function RecommendationDetailsScreen({ navigation, route }: Props) {
  const { decision, merchant, amount } = route.params;
  const journeyActions = usePaymentJourneyActions();
  const [completedMessage, setCompletedMessage] = useState<string | null>(null);
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
            borderColor: "rgba(56, 189, 248, 0.4)"
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
              <Pill label="Estimated value" value={formatCurrency(decision.estimatedValue)} />
              <Pill label="Reward rate" value={estimatedRate} />
              <Pill label="Confidence" value={formatConfidence(decision.confidence)} />
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ gap: 10 }}>
            <Heading>Why Rewardly chose it</Heading>
            <Body>{decision.explanation.summary || decision.reason}</Body>
          </View>
        </Card>

        <Card>
          <View style={{ gap: 10 }}>
            <Heading>What mattered</Heading>
            {decision.explanation.factors.length ? (
              decision.explanation.factors.map((factor) => (
                <View key={factor} style={{ flexDirection: "row", gap: 10 }}>
                  <Text style={{ color: colors.cyan, fontWeight: "900" }}>-</Text>
                  <Body style={{ flex: 1 }}>{factor}</Body>
                </View>
              ))
            ) : (
              <Body>
                Rewardly compared this purchase against the cards currently in your
                wallet.
              </Body>
            )}
          </View>
        </Card>

        <Card style={{ borderColor: "rgba(52, 211, 153, 0.38)" }}>
          <View style={{ gap: 12 }}>
            <Heading>Ready to pay?</Heading>
            <Body>
              Mark this as completed after you use the recommended card. Rewardly will
              add it to your Payment Journey.
            </Body>
            <Button
              title="Complete Purchase"
              onPress={() => {
                const entry = journeyActions.completePurchase({
                  decision,
                  merchant,
                  amount,
                  selectedCard: decision.recommendedPaymentMethod?.displayName
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
              This recommendation came from the Rewardly API. The mobile app does not
              run or duplicate recommendation logic.
            </Body>
            <Body>Decision ID: {decision.decisionId}</Body>
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
