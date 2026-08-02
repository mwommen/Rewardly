import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { LoadingState } from "@/components/StateViews";
import { Body, Heading } from "@/components/Text";
import { useCardCatalog, useWallet, useWalletActions } from "@/hooks/useWallet";
import type { RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "AddCard">;

export function AddCardScreen({ navigation }: Props) {
  const catalog = useCardCatalog();
  const wallet = useWallet();
  const walletActions = useWalletActions();
  const owned = new Set(wallet.data?.map((card) => card.cardId));

  return (
    <Screen>
      <View style={{ gap: 14 }}>
        <Body>Select cards you already own from the Rewardly catalog.</Body>
        {catalog.isLoading ? (
          <LoadingState label="Loading card catalog..." />
        ) : (
          catalog.data?.map((card) => {
            const added = owned.has(card.cardId);
            return (
              <Pressable
                key={card.cardId}
                disabled={added}
                onPress={() => {
                  walletActions.addCard(card);
                  navigation.goBack();
                }}
              >
                <Card style={{ opacity: added ? 0.55 : 1 }}>
                  <View style={{ gap: 6 }}>
                    <Heading>{card.displayName}</Heading>
                    <Body>
                      {card.issuer || "Issuer"} - {card.rewardProgram || "Rewards"}
                    </Body>
                    <Text style={{ color: added ? colors.green : colors.cyan, fontWeight: "800" }}>
                      {added ? "Already in wallet" : "Add to wallet"}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}
      </View>
    </Screen>
  );
}
