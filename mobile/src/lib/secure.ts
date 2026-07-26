import * as SecureStore from 'expo-secure-store'

/**
 * Thin wrapper over expo-secure-store for the device identifier — the stable
 * per-installation id the server pairs with the local sequence to order a
 * device's replay. Kept behind this module so it can be mocked in tests and so
 * the storage choice (Keychain / Keystore) lives in one place.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key)
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value)
}

export async function deleteSecureItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key)
}
