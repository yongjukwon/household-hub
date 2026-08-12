# Local Run README Design

## Goal

Create a root `README.md` that lets a developer run Household Hub on the web
or on a mobile simulator/device against the local Supabase stack and sign in
with a seeded test account.

## Structure

The README will contain:

1. A short project overview and repository layout.
2. Prerequisites: Node.js 20.19+, npm, Docker, Supabase CLI, Xcode for iOS,
   and Android Studio for Android.
3. One-time shared setup: install workspace dependencies, start Supabase,
   populate the web and mobile environment files, and seed the test household.
4. Web execution from the repository root with `npm run dev`.
5. Mobile execution from `mobile/` with `npm run ios` or `npm run android`,
   noting that a development build is required instead of Expo Go.
6. The two verified local test accounts and their roles.
7. A compact command reference for tests, linting, type checking, and builds.

## Credential Handling

The README will publish only the existing local test credentials already
documented in the repository. Supabase service-role keys and provider secrets
will never be included. The seed command will use placeholders and direct the
developer to obtain local values from `npx supabase status`.

## Accuracy Rules

- Commands and environment variable names will match the current package
  scripts and application source.
- Web password login will require `VITE_ENABLE_TEST_AUTH=true`.
- Mobile password login will require `EXPO_PUBLIC_ENABLE_TEST_AUTH=true`.
- Local URLs will use this repository's configured Supabase API port, `55321`.
- The document will distinguish root commands from commands run in `mobile/`.

## Verification

After creating the README, verify every referenced script and file against the
repository, run Markdown formatting checks where available, and run
`git diff --check`.
