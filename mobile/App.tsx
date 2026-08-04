import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { Component, type ErrorInfo, type PropsWithChildren } from "react";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppNavigator } from "@/navigation/AppNavigator";
import { Button } from "@/components/Button";
import { captureAppError } from "@/services/errorReporting";
import { colors } from "@/theme/colors";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1
    }
  }
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

type ErrorBoundaryState = {
  hasError: boolean;
};

class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureAppError(error, { componentStack: info.componentStack || undefined });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          gap: 18,
          padding: 24,
          backgroundColor: colors.background
        }}
      >
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}>
          Rewardly needs a refresh.
        </Text>
        <Text style={{ color: colors.muted, fontSize: 16 }}>
          Something went wrong in the mobile MVP shell.
        </Text>
        <Button title="Try again" onPress={() => this.setState({ hasError: false })} />
      </View>
    );
  }
}
