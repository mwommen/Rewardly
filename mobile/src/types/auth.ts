export type RewardlyUser = {
  userId: string;
  email: string;
  displayName: string | null;
  status: "active" | "suspended" | "deleted";
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  onboardingCompletedAt: string | null;
  dataSchemaVersion: number;
};

export type AuthSession = {
  user: RewardlyUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  refreshExpiresAt: string;
};
