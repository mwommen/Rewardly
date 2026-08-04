import type { PropsWithChildren } from "react";
import { View, type ViewProps } from "react-native";
import { colors } from "@/theme/colors";

export function Card({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: colors.panel,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: "rgba(148, 163, 184, 0.16)",
          padding: 18
        },
        style
      ]}
    >
      {children}
    </View>
  );
}
