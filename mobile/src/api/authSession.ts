import { getJson, removeItem, setJson } from "@/storage/secureStorage";
import { storageKeys } from "@/storage/keys";
import type { AuthSession } from "@/types/auth";

let memorySession: AuthSession | null = null;

export async function getStoredAuthSession() {
  if (memorySession) return memorySession;
  memorySession = await getJson<AuthSession | null>(storageKeys.authSession, null);
  return memorySession;
}

export async function setStoredAuthSession(session: AuthSession) {
  memorySession = session;
  await setJson(storageKeys.authSession, session);
}

export async function clearStoredAuthSession() {
  memorySession = null;
  await removeItem(storageKeys.authSession);
}

export function currentAuthSession() {
  return memorySession;
}
