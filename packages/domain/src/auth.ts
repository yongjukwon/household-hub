/** Production authentication providers. Web and native both use these. */
export const oauthProviders = ['google', 'apple'] as const

export type OAuthProvider = (typeof oauthProviders)[number]

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return (
    typeof value === 'string' &&
    oauthProviders.includes(value as OAuthProvider)
  )
}

export interface AuthEnvironment {
  isProduction: boolean
  testAuthEnabled: boolean
}

/**
 * Production is OAuth-only (Google/Apple). Email + password sign-in — used for
 * the seeded test accounts — is available only in a non-production build that
 * explicitly opts in via the test-auth flag. Both conditions are required, so a
 * production build can never expose the password path even if the flag leaks.
 */
export function isPasswordAuthAllowed(env: AuthEnvironment): boolean {
  return env.isProduction === false && env.testAuthEnabled === true
}
