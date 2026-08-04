import * as SecureStore from "expo-secure-store";

export async function getJson<T>(key: string, fallback: T): Promise<T> {
  const value = await SecureStore.getItemAsync(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function setJson<T>(key: string, value: T) {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

export async function removeItem(key: string) {
  await SecureStore.deleteItemAsync(key);
}
