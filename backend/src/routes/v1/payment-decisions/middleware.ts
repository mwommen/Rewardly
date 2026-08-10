import { authenticateAccessToken } from "../../../services/productionAuthService";

export async function optionalAuthUser(authorizationHeader?: string) {
  if (!authorizationHeader) return null;
  try {
    return await authenticateAccessToken(authorizationHeader);
  } catch {
    return null;
  }
}

export function accessScopeForAuthUser(authUser: Awaited<ReturnType<typeof optionalAuthUser>>) {
  return {
    ownerUserId: authUser?.userId || null,
    tenantId: null,
  };
}
