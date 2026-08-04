import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { colors } from "@/theme/colors";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { WelcomeScreen } from "@/screens/WelcomeScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { WalletScreen } from "@/screens/WalletScreen";
import { AddCardScreen } from "@/screens/AddCardScreen";
import { PurchaseSimulatorScreen } from "@/screens/PurchaseSimulatorScreen";
import { RecommendationDetailsScreen } from "@/screens/RecommendationDetailsScreen";
import { MerchantSearchScreen } from "@/screens/MerchantSearchScreen";
import { PaymentJourneyScreen } from "@/screens/PaymentJourneyScreen";
import { PaymentDetailScreen } from "@/screens/PaymentDetailScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { WalletCoachScreen } from "@/screens/WalletCoachScreen";
import { OpportunityDetailScreen } from "@/screens/OpportunityDetailScreen";
import { PlanningScreen } from "@/screens/PlanningScreen";
import { PlanDetailScreen } from "@/screens/PlanDetailScreen";
import { AuthScreen } from "@/screens/AuthScreen";
import { useAuthSession } from "@/hooks/useAuth";
import { ActivityIndicator, View } from "react-native";
import { Body } from "@/components/Text";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.ink,
    text: colors.text,
    border: colors.line,
    primary: colors.cyan
  }
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.ink,
          borderTopColor: colors.line
        },
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.muted
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Coach" component={WalletCoachScreen} />
      <Tabs.Screen name="Planning" component={PlanningScreen} />
      <Tabs.Screen
        name="Simulator"
        component={PurchaseSimulatorScreen}
        options={{ title: "Smart Pay", tabBarLabel: "Smart Pay" }}
      />
      <Tabs.Screen name="Wallet" component={WalletScreen} />
      <Tabs.Screen
        name="Journey"
        component={PaymentJourneyScreen}
        options={{ title: "Journey", tabBarLabel: "Journey" }}
      />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const session = useAuthSession();

  if (session.isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
          gap: 12
        }}
      >
        <ActivityIndicator color={colors.cyan} />
        <Body>Restoring your Rewardly session...</Body>
      </View>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.ink },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background }
        }}
      >
        {!session.data ? (
          <Stack.Screen name="Welcome" component={AuthScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="AddCard" component={AddCardScreen} options={{ title: "Add card" }} />
            <Stack.Screen
              name="MerchantSearch"
              component={MerchantSearchScreen}
              options={{ title: "Merchant search" }}
            />
            <Stack.Screen
              name="RecommendationDetails"
              component={RecommendationDetailsScreen}
              options={{ title: "Recommendation" }}
            />
            <Stack.Screen
              name="PaymentDetail"
              component={PaymentDetailScreen}
              options={{ title: "Payment detail" }}
            />
            <Stack.Screen
              name="OpportunityDetail"
              component={OpportunityDetailScreen}
              options={{ title: "Opportunity" }}
            />
            <Stack.Screen
              name="PlanDetail"
              component={PlanDetailScreen}
              options={{ title: "Shopping plan" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
