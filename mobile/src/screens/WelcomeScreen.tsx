import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { Body, Heading, Title } from "@/components/Text";
import { useWalletActions } from "@/hooks/useWallet";
import type { RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import { demoWallet } from "@/utils/demo";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  const wallet = useWalletActions();

  return (
    <Screen>
      <View style={{ gap: 28, paddingTop: 56 }}>
        <View style={{ gap: 14 }}>
          <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "900" }}>
            REWARDLY
          </Text>
          <Title style={{ fontSize: 40, lineHeight: 45 }}>
            The smarter way to choose a card.
          </Title>
          <Body>
            Open Smart Pay, enter where you are paying, and Rewardly tells you which
            card from your wallet gives the best value.
          </Body>
        </View>

        <Card style={{ borderRadius: 28 }}>
          <View style={{ gap: 10 }}>
            <Heading>Fast, calm, wallet-first.</Heading>
            <Body>
              No card numbers. No bank login. The mobile app asks the Rewardly API for
              recommendations and keeps your test wallet on this device.
            </Body>
          </View>
        </Card>

        <View style={{ gap: 12 }}>
          <Button title="Start Rewardly" onPress={() => navigation.replace("MainTabs")} />
          <Button
            title="Try demo Smart Pay"
            variant="secondary"
            onPress={() => {
              wallet.replaceWallet(demoWallet);
              navigation.replace("MainTabs", {
                screen: "Simulator",
                params: { merchant: { name: "Target", category: "general_retail" } }
              });
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
