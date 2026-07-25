export type SetupCheckId =
  | "wallet"
  | "extension"
  | "permissions"
  | "demo"
  | "ready";

export type SetupCheckStatus = "complete" | "attention" | "waiting";

export type SetupCheck = {
  id: SetupCheckId;
  label: string;
  status: SetupCheckStatus;
  help: string;
};

export type BrowserValidation = {
  extensionInstalled: boolean;
  userSessionReady: boolean;
  walletAvailable: boolean;
  permissionsReady: boolean;
};

export type OnboardingStateInput = {
  walletCardCount: number;
  extensionInstalled: boolean;
  demoCompleted: boolean;
};

export const DEMO_MERCHANTS = [
  "Amazon",
  "Target",
  "Starbucks",
  "Hilton",
  "DoorDash",
];

export const SUPPORTED_MERCHANT_GROUPS = [
  {
    category: "Shopping",
    merchants: ["Amazon", "Target", "Apple", "Best Buy", "Walmart"],
  },
  {
    category: "Travel",
    merchants: ["Hilton", "Marriott", "Delta", "United", "Airbnb"],
  },
  {
    category: "Dining",
    merchants: ["DoorDash", "Uber Eats", "Starbucks"],
  },
  {
    category: "Home Improvement",
    merchants: ["Home Depot", "Lowe's"],
  },
  {
    category: "Everyday Spending",
    merchants: ["Costco", "Groceries", "Gas", "Drugstores"],
  },
];

export function browserValidationFor({
  walletCardCount,
  extensionInstalled,
}: Pick<OnboardingStateInput, "walletCardCount" | "extensionInstalled">): BrowserValidation {
  return {
    extensionInstalled,
    userSessionReady: true,
    walletAvailable: walletCardCount > 0,
    permissionsReady: extensionInstalled,
  };
}

export function setupChecksFor(input: OnboardingStateInput): SetupCheck[] {
  const validation = browserValidationFor(input);
  const walletReady = validation.walletAvailable;
  const extensionReady = validation.extensionInstalled;
  const permissionsReady = validation.permissionsReady;
  const demoReady = input.demoCompleted;
  const ready = walletReady && extensionReady && permissionsReady && demoReady;

  return [
    {
      id: "wallet",
      label: "Add your cards",
      status: walletReady ? "complete" : "attention",
      help: walletReady
        ? `${input.walletCardCount} cards are available for recommendations.`
        : "Add your first card to continue.",
    },
    {
      id: "extension",
      label: "Verify extension",
      status: extensionReady ? "complete" : "attention",
      help: extensionReady
        ? "Rewardly is installed in this browser."
        : "Install or refresh the Rewardly Chrome Extension.",
    },
    {
      id: "permissions",
      label: "Check browser permissions",
      status: permissionsReady ? "complete" : "attention",
      help: permissionsReady
        ? "Rewardly can detect supported checkout pages."
        : "Rewardly needs permission to detect supported checkout pages.",
    },
    {
      id: "demo",
      label: "Test Rewardly",
      status: demoReady ? "complete" : "waiting",
      help: demoReady
        ? "Your demo recommendation is ready below."
        : "Run a demo recommendation before you shop.",
    },
    {
      id: "ready",
      label: "Ready",
      status: ready ? "complete" : "waiting",
      help: ready
        ? "Rewardly is ready for supported checkout pages."
        : "Complete the setup steps to finish.",
    },
  ];
}

export function setupProgress(checks: SetupCheck[]) {
  if (!checks.length) return 0;
  const complete = checks.filter((check) => check.status === "complete").length;
  return Math.round((complete / checks.length) * 100);
}
