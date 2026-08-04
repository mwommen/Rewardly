import { useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { EmptyState } from "@/components/StateViews";
import { Body, Heading, Title } from "@/components/Text";
import {
  usePaymentJourney,
  usePaymentJourneyActions
} from "@/hooks/usePaymentJourney";
import type { RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import type { PaymentJourneyEntry } from "@/types/paymentJourney";
import { reinforcementMessage } from "@/utils/paymentJourney";
import { formatConfidence, formatCurrency, shortDate } from "@/utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "PaymentDetail">;

export function PaymentDetailScreen({ route }: Props) {
  const journey = usePaymentJourney();
  const actions = usePaymentJourneyActions();
  const entry = useMemo(
    () =>
      journey.data?.find(
        (item: PaymentJourneyEntry) => item.paymentId === route.params.paymentId
      ),
    [journey.data, route.params.paymentId]
  );
  const [notes, setNotes] = useState(entry?.userNotes || "");

  if (!entry) {
    return (
      <Screen>
        <EmptyState
          title="Payment not found."
          body="This completed payment may have been removed from local storage."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 18 }}>
        <Card style={{ borderRadius: 30, borderColor: "rgba(52, 211, 153, 0.35)" }}>
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.green, fontSize: 13, fontWeight: "900" }}>
              COMPLETED PAYMENT
            </Text>
            <Title>{entry.merchant}</Title>
            <Body>{formatCurrency(entry.purchaseAmount)} - {entry.selectedCard}</Body>
            <Heading>{reinforcementMessage(entry)}</Heading>
          </View>
        </Card>

        <Card>
          <View style={{ gap: 10 }}>
            <Heading>Recommendation</Heading>
            <Body>{entry.recommendationExplanation.summary}</Body>
            <Body>Estimated rewards: {formatCurrency(entry.estimatedRewardValue)}</Body>
            <Body>Confidence: {formatConfidence(entry.confidence)}</Body>
          </View>
        </Card>

        <Card>
          <View style={{ gap: 10 }}>
            <Heading>Timing</Heading>
            <Body>Recommended: {shortDate(entry.purchaseTimestamp)}</Body>
            <Body>Completed: {shortDate(entry.completionTimestamp)}</Body>
            <Body>Decision ID: {entry.decisionId}</Body>
          </View>
        </Card>

        <Card>
          <View style={{ gap: 12 }}>
            <Heading>Notes</Heading>
            <TextInput
              accessibilityLabel="Payment notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Add a note for later..."
              placeholderTextColor={colors.muted}
              multiline
              style={{
                minHeight: 92,
                color: colors.text,
                backgroundColor: colors.ink,
                borderRadius: 16,
                padding: 14,
                textAlignVertical: "top"
              }}
            />
            <Button
              title="Save notes"
              variant="secondary"
              onPress={() => actions.updateNotes(entry.paymentId, notes)}
            />
          </View>
        </Card>

        <Card style={{ backgroundColor: colors.ink }}>
          <View style={{ gap: 8 }}>
            <Heading>Reserved for future intelligence</Heading>
            <Body>Receipt image, OCR, merchant logo, and AI coaching will fit here later.</Body>
          </View>
        </Card>
      </View>
    </Screen>
  );
}
