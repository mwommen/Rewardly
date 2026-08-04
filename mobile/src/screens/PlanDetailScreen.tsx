import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState, LoadingState } from "@/components/StateViews";
import { Body, Heading, Title } from "@/components/Text";
import { readableApiError } from "@/api/client";
import { usePaymentJourneyActions } from "@/hooks/usePaymentJourney";
import { usePlan, usePlanActions, usePlanOptimization } from "@/hooks/usePlans";
import type { RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import type { PlanOptimization, ShoppingPlanItem } from "@/types/planning";
import { formatConfidence, formatCurrency } from "@/utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "PlanDetail">;

type FormValues = {
  merchant: string;
  amount: string;
  notes: string;
};

export function PlanDetailScreen({ route }: Props) {
  const { planId } = route.params;
  const plan = usePlan(planId);
  const optimization = usePlanOptimization(planId);
  const actions = usePlanActions();
  const journeyActions = usePaymentJourneyActions();
  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      merchant: "Target",
      amount: "100",
      notes: ""
    }
  });

  const submitItem = handleSubmit(async (values) => {
    await actions.addItem({
      planId,
      input: {
        merchant: { name: values.merchant },
        purchase: { amount: Number(values.amount), currency: "USD" },
        notes: values.notes
      }
    });
    reset({ merchant: "Target", amount: "100", notes: "" });
  });

  if (plan.isLoading) return <LoadingState label="Loading plan..." />;

  if (!plan.data) {
    return (
      <EmptyState
        title="Plan not found."
        body="Create a new shopping plan from the Planning tab."
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
          SHOPPING PLAN
        </Text>
        <Title>{plan.data.title}</Title>
        <Body>{plan.data.notes || "Optimize future purchases before checkout."}</Body>
      </View>

      <Card>
        <View style={{ gap: 14 }}>
          <Heading>Add planned purchase</Heading>
          <Controller
            name="merchant"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextInput
                accessibilityLabel="Planned merchant"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="Merchant"
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
                accessibilityLabel="Planned amount"
                value={field.value}
                onChangeText={field.onChange}
                keyboardType="decimal-pad"
                placeholder="Estimated amount"
                placeholderTextColor={colors.muted}
                style={inputStyle}
              />
            )}
          />
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextInput
                accessibilityLabel="Planned purchase notes"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="Notes"
                placeholderTextColor={colors.muted}
                style={inputStyle}
              />
            )}
          />
          <Button title="Add purchase" loading={actions.isSaving} onPress={submitItem} />
        </View>
      </Card>

      {plan.error ? <Body>{readableApiError(plan.error)}</Body> : null}
      {optimization.error ? <Body>{readableApiError(optimization.error)}</Body> : null}

      {optimization.isLoading && plan.data.items.length ? (
        <Card>
          <View style={{ gap: 10 }}>
            <ActivityIndicator color={colors.cyan} />
            <Heading>Optimizing plan...</Heading>
            <Body>Rewardly is running each planned purchase through the API.</Body>
          </View>
        </Card>
      ) : optimization.data ? (
        <OptimizationSummary optimization={optimization.data} />
      ) : null}

      {plan.data.items.length ? (
        <View style={{ gap: 12 }}>
          <Heading>Planned purchases</Heading>
          {plan.data.items.map((item: ShoppingPlanItem) => {
            const optimizedItem = optimization.data?.optimizedItems.find(
              (candidate: PlanOptimization["optimizedItems"][number]) =>
                candidate.itemId === item.itemId
            );
            return (
              <Card key={item.itemId}>
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Heading>{item.merchant.name}</Heading>
                      <Body>{formatCurrency(item.purchase.amount)}</Body>
                    </View>
                    <Text style={{ color: item.completionState === "completed" ? colors.green : colors.cyan, fontWeight: "900" }}>
                      {item.completionState}
                    </Text>
                  </View>
                  {optimizedItem ? (
                    <View style={{ gap: 6 }}>
                      <Body>Best card</Body>
                      <Heading>
                        {optimizedItem.decision.recommendedPaymentMethod?.displayName ||
                          "No card found"}
                      </Heading>
                      <Body>{optimizedItem.decision.explanation.summary}</Body>
                      <Body>
                        Confidence {formatConfidence(optimizedItem.decision.confidence)}
                      </Body>
                    </View>
                  ) : null}
                  {item.completionState !== "completed" && optimizedItem ? (
                    <Button
                      title="Mark complete"
                      variant="secondary"
                      loading={actions.isSaving || journeyActions.isSaving}
                      onPress={async () => {
                        journeyActions.completePurchase({
                          decision: optimizedItem.decision,
                          merchant: item.merchant.name,
                          amount: item.purchase.amount
                        });
                        await actions.completeItem({
                          planId,
                          itemId: item.itemId,
                          decisionId: optimizedItem.decision.decisionId
                        });
                      }}
                    />
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <EmptyState
          title="Add merchants to optimize this plan."
          body="Each planned purchase will receive a best-card recommendation from the API."
        />
      )}
    </ScrollView>
  );
}

function OptimizationSummary({ optimization }: { optimization: PlanOptimization }) {
  return (
    <Card style={{ borderRadius: 28, borderColor: "rgba(56, 189, 248, 0.4)" }}>
      <View style={{ gap: 12 }}>
        <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "900" }}>
          PLAN OPTIMIZED
        </Text>
        <Title style={{ fontSize: 30 }}>
          {formatCurrency(optimization.estimatedTotalRewards)}
        </Title>
        <Body>Estimated total rewards for this plan.</Body>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Metric label="Planned" value={String(optimization.progress.plannedPurchases)} />
          <Metric label="Complete" value={String(optimization.progress.completedPurchases)} />
          <Metric label="Remaining" value={String(optimization.progress.remainingPurchases)} />
        </View>
        <Body>{optimization.opportunitySummary}</Body>
      </View>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 105,
        backgroundColor: colors.ink,
        borderRadius: 16,
        padding: 12,
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
