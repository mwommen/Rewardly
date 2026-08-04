import type { PropsWithChildren } from "react";
import { Text as RNText, type TextProps } from "react-native";
import { colors } from "@/theme/colors";

export function Title({ children, style, ...props }: PropsWithChildren<TextProps>) {
  return (
    <RNText
      {...props}
      style={[{ color: colors.text, fontSize: 30, fontWeight: "800" }, style]}
    >
      {children}
    </RNText>
  );
}

export function Heading({ children, style, ...props }: PropsWithChildren<TextProps>) {
  return (
    <RNText
      {...props}
      style={[{ color: colors.text, fontSize: 20, fontWeight: "700" }, style]}
    >
      {children}
    </RNText>
  );
}

export function Body({ children, style, ...props }: PropsWithChildren<TextProps>) {
  return (
    <RNText
      {...props}
      style={[{ color: colors.muted, fontSize: 15, lineHeight: 22 }, style]}
    >
      {children}
    </RNText>
  );
}
