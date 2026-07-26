import * as Crypto from 'expo-crypto'

/**
 * A v4 UUID. Prefers the platform WebCrypto (present in the Jest/Node
 * environment) and falls back to `expo-crypto` on device, where React Native
 * has no global `crypto.randomUUID`.
 */
export function newUuid(): string {
  const webCrypto = globalThis.crypto
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID()
  }
  return Crypto.randomUUID()
}
