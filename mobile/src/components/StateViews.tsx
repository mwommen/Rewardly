import { ActivityIndicator, View } from "react-native";
import { Body, Heading } from "@/components/Text";
import { colors } from "@/theme/colors";

export function LoadingState({ label = "Checking Rewardly..." }: { label?: string }) {
  return (
    <View style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
      <ActivityIndicator color={colors.cyan} />
      <Body>{label}</Body>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 6, paddingVertical: 8 }}>
      <Heading>{title}</Heading>
      <Body>{body}</Body>
    </View>
  );
}
