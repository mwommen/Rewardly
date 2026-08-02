import { ActivityIndicator, Pressable, Text } from "react-native";
import { colors } from "@/theme/colors";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false
}: Props) {
  const backgroundColor =
    variant === "primary" ? colors.cyan : variant === "danger" ? colors.danger : colors.card;
  const color = variant === "primary" ? colors.ink : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor,
        opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
        paddingHorizontal: 18
      })}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={{ color, fontSize: 16, fontWeight: "800" }}>{title}</Text>
      )}
    </Pressable>
  );
}
