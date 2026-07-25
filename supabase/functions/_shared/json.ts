// The JSON value type shared by the Edge Functions.
//
// It lives apart from `supabase.ts` so modules that only need the type (and are
// also compiled by the browser toolchain through the parity tests) do not pull
// Deno-only runtime code into the web TypeScript program.

export type Json =
  string | number | boolean | null | Json[] | { [key: string]: Json }
