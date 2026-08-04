import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { Body, Title } from "@/components/Text";
import { readableApiError } from "@/api/client";
import { useAuthActions } from "@/hooks/useAuth";
import { colors } from "@/theme/colors";

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup" | "recovery">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const auth = useAuthActions();
  const active = mode === "signup" ? auth.signUp : auth.signIn;

  const submit = () => {
    if (mode === "signup") {
      auth.signUp.mutate({ email, password, displayName });
      return;
    }
    auth.signIn.mutate({ email, password });
  };

  if (mode === "recovery") {
    return (
      <Screen>
        <View style={{ gap: 18 }}>
          <Title>Account recovery</Title>
          <Body>
            Password reset email delivery is not enabled in this local build. For beta,
            contact Rewardly support to reset your account.
          </Body>
          <Button title="Back to sign in" onPress={() => setMode("signin")} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 18 }}>
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "900" }}>
            REWARDLY
          </Text>
          <Title>{mode === "signup" ? "Create your account." : "Welcome back."}</Title>
          <Body>
            Sign in to sync your wallet, payment journey, plans, and preferences
            across devices.
          </Body>
        </View>
        {mode === "signup" ? (
          <TextInput
            accessibilityLabel="Display name"
            placeholder="Display name"
            placeholderTextColor={colors.muted}
            value={displayName}
            onChangeText={setDisplayName}
            style={inputStyle}
          />
        ) : null}
        <TextInput
          accessibilityLabel="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          style={inputStyle}
        />
        <TextInput
          accessibilityLabel="Password"
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          style={inputStyle}
        />
        {active.error ? <Body>{readableApiError(active.error)}</Body> : null}
        <Button
          title={mode === "signup" ? "Create account" : "Sign in"}
          loading={active.isPending}
          onPress={submit}
        />
        <Button
          title={mode === "signup" ? "I already have an account" : "Create account"}
          variant="secondary"
          onPress={() => setMode(mode === "signup" ? "signin" : "signup")}
        />
        <Button title="Forgot password" variant="secondary" onPress={() => setMode("recovery")} />
      </View>
    </Screen>
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
