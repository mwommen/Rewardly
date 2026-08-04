import type { NavigatorScreenParams } from "@react-navigation/native";
import type { MerchantSuggestion, PaymentDecisionResponse } from "@/types/rewardly";

export type MainTabParamList = {
  Home: undefined;
  Coach: undefined;
  Planning: undefined;
  Wallet: undefined;
  Simulator:
    | {
        merchant?: MerchantSuggestion;
      }
    | undefined;
  Journey: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  AddCard: undefined;
  MerchantSearch:
    | {
        onSelectRoute?: "Simulator";
      }
    | undefined;
  RecommendationDetails: {
    decision: PaymentDecisionResponse;
    merchant: string;
    amount: number;
  };
  PaymentDetail: {
    paymentId: string;
  };
  OpportunityDetail: {
    opportunityId: string;
  };
  PlanDetail: {
    planId: string;
  };
};
