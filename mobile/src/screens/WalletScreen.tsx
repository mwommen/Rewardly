import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { EmptyState, LoadingState } from "@/components/StateViews";
import { Body, Heading, Title } from "@/components/Text";
import { useWallet, useWalletActions } from "@/hooks/useWallet";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Wallet">,
  NativeStackScreenProps<RootStackParamList>
>;

export function WalletScreen({ navigation }: Props) {
  const wallet = useWallet();
  const walletActions = useWalletActions();

  return (
    <Screen>
      <View style={{ gap: 18 }}>
        <View style={{ gap: 8 }}>
          <Title>Your Wallet</Title>
          <Body>Choose the cards you own. Rewardly never asks for card numbers.</Body>
        </View>

        <Button title="Add card" onPress={() => navigation.navigate("AddCard")} />

        {wallet.isLoading ? (
          <LoadingState label="Loading wallet..." />
        ) : !wallet.data?.length ? (
          <EmptyState
            title="Your wallet is empty."
            body="Add a supported card or load demo mode to start using Smart Pay."
          />
        ) : (
          wallet.data.map((card) => (
            <Card key={card.cardId}>
              <View style={{ gap: 12 }}>
                <View style={{ gap: 4 }}>
                  <Heading>{card.nickname || card.displayName}</Heading>
                  <Body>
                    {card.issuer || "Issuer"} - {card.rewardProgram || "Rewards"}
                  </Body>
                </View>
                <TextInput
                  placeholder="Nickname"
                  placeholderTextColor={colors.muted}
                  defaultValue={card.nickname}
                  onEndEditing={(event) =>
                    walletActions.updateNickname(card.cardId, event.nativeEvent.text)
                  }
                  style={{
                    color: colors.text,
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    padding: 12
                  }}
                />
                <Button
                  title="Remove"
                  variant="secondary"
                  onPress={() => walletActions.removeCard(card.cardId)}
                />
              </View>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}
