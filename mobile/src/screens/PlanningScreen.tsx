import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState, LoadingState } from "@/components/StateViews";
import { Body, Heading, Title } from "@/components/Text";
import { readableApiError } from "@/api/client";
import { usePlanActions, usePlans } from "@/hooks/usePlans";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import type { ShoppingPlan } from "@/types/planning";
import { shortDate } from "@/utils/format";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Planning">,
  NativeStackScreenProps<RootStackParamList>
>;

type FormValues = {
  title: string;
  notes: string;
};

export function PlanningScreen({ navigation }: Props) {
  const plans = usePlans();
  const actions = usePlanActions();
  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      title: "Saturday Shopping",
      notes: ""
    }
  });

  const submit = handleSubmit(async (values) => {
    const plan = await actions.createPlan({
      title: values.title,
      notes: values.notes
    });
    reset({ title: "Saturday Shopping", notes: "" });
    navigation.navigate("PlanDetail", { planId: plan.planId });
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 18 }}
      refreshControl={
        <RefreshControl
          refreshing={plans.isRefetching}
          onRefresh={plans.refetch}
          tintColor={colors.cyan}
        />
      }
    >
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "900" }}>
          PLANNED SPENDING
        </Text>
        <Title>Prepare before you spend.</Title>
        <Body>
          Create a shopping plan, add merchants, and let the Rewardly API optimize
          each planned purchase before checkout.
        </Body>
      </View>

      <Card style={{ borderRadius: 28, borderColor: "rgba(56, 189, 248, 0.35)" }}>
        <View style={{ gap: 14 }}>
          <Heading>Create a shopping plan</Heading>
          <Controller
            name="title"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextInput
                accessibilityLabel="Plan title"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="Plan title"
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
                accessibilityLabel="Plan notes"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="Notes"
                placeholderTextColor={colors.muted}
                style={inputStyle}
              />
            )}
          />
          <Button title="Create plan" loading={actions.isSaving} onPress={submit} />
        </View>
      </Card>

      {plans.error ? <Body>{readableApiError(plans.error)}</Body> : null}

      {plans.isLoading ? (
        <LoadingState label="Loading shopping plans..." />
      ) : plans.data?.length ? (
        <View style={{ gap: 12 }}>
          <Heading>Your plans</Heading>
          {plans.data.map((plan: ShoppingPlan) => (
            <PlanCard
              key={plan.planId}
              plan={plan}
              onPress={() => navigation.navigate("PlanDetail", { planId: plan.planId })}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="No plans yet."
          body="Create a plan to optimize purchases before they happen."
        />
      )}
    </ScrollView>
  );
}

function PlanCard({ plan, onPress }: { plan: ShoppingPlan; onPress: () => void }) {
  const completed = plan.items.filter((item) => item.completionState === "completed").length;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <Heading>{plan.title}</Heading>
            <Text style={{ color: plan.status === "completed" ? colors.green : colors.cyan, fontWeight: "900" }}>
              {plan.status}
            </Text>
          </View>
          <Body>
            {completed}/{plan.items.length} purchases complete
          </Body>
          <Body>Updated {shortDate(plan.updatedAt)}</Body>
        </View>
      </Card>
    </Pressable>
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
