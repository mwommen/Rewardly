import { View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { Body, Heading, Title } from "@/components/Text";
import { apiBaseUrl } from "@/config/env";
import { useApiHealth } from "@/hooks/useApiHealth";
import { useDevIdentity } from "@/hooks/useDevIdentity";
import { useFavoriteMerchantActions } from "@/hooks/useFavoriteMerchants";
import {
  useLocationPermission,
  useLocationPermissionActions
} from "@/hooks/useLocationPermission";
import { usePaymentJourneyActions } from "@/hooks/usePaymentJourney";
import { useRecentPurchaseActions } from "@/hooks/useRecentPurchases";
import { useSmartPayStateActions } from "@/hooks/useSmartPayState";
import { useWalletActions } from "@/hooks/useWallet";
import { useWalletCoachActions } from "@/hooks/useWalletCoach";
import { demoWallet } from "@/utils/demo";

export function SettingsScreen() {
  const health = useApiHealth();
  const devIdentity = useDevIdentity();
  const location = useLocationPermission();
  const locationActions = useLocationPermissionActions();
  const favorites = useFavoriteMerchantActions();
  const journey = usePaymentJourneyActions();
  const wallet = useWalletActions();
  const recent = useRecentPurchaseActions();
  const smartPay = useSmartPayStateActions();
  const coach = useWalletCoachActions();

  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Title>Settings</Title>
          <Body>Keep the MVP simple: environment, cache, version, and about.</Body>
        </View>

        <Card>
          <View style={{ gap: 8 }}>
            <Heading>API environment</Heading>
            <Body>{apiBaseUrl()}</Body>
            <Body>Status: {health.data?.status || "Not checked"}</Body>
            <Body>Temporary mobile ID: {devIdentity.data || "Creating..."}</Body>
          </View>
        </Card>

        <Card>
          <View style={{ gap: 12 }}>
            <Heading>Demo mode</Heading>
            <Body>Load a sample wallet so a first-time tester can try Smart Pay quickly.</Body>
            <Button
              title="Load demo wallet"
              variant="secondary"
              onPress={() => wallet.replaceWallet(demoWallet)}
            />
          </View>
        </Card>

        <Card>
          <View style={{ gap: 12 }}>
            <Heading>Location</Heading>
            <Body>
              Status: {location.data?.granted ? "Enabled while using app" : "Not enabled"}
            </Body>
            <Body>
              Rewardly uses location only while the app is open to suggest nearby
              merchants.
            </Body>
            <Button
              title="Enable nearby suggestions"
              variant="secondary"
              loading={locationActions.isRequesting}
              onPress={() => locationActions.requestWhenInUse()}
            />
          </View>
        </Card>

        <Card>
          <View style={{ gap: 12 }}>
            <Heading>Local data</Heading>
            <Button
              title="Clear recent recommendations"
              variant="secondary"
              onPress={recent.clearRecentPurchases}
            />
            <Button
              title="Clear payment journey"
              variant="secondary"
              onPress={journey.clearJourney}
            />
            <Button
              title="Reset coach dismissals"
              variant="secondary"
              onPress={coach.clearDismissedOpportunities}
            />
            <Button
              title="Clear recent merchants"
              variant="secondary"
              onPress={smartPay.clearRecentMerchants}
            />
            <Button
              title="Clear favorites"
              variant="secondary"
              onPress={favorites.clearFavorites}
            />
            <Button title="Clear wallet" variant="danger" onPress={wallet.clearWallet} />
          </View>
        </Card>

        <Card>
          <View style={{ gap: 8 }}>
            <Heading>About Rewardly</Heading>
            <Body>
              Rewardly helps people make smarter payment decisions by recommending the
              best card from the cards they already own.
            </Body>
            <Body>Mobile MVP version 0.1.0</Body>
          </View>
        </Card>
      </View>
    </Screen>
  );
}
