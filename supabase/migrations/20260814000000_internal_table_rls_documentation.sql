-- These two household-scoped tables are implementation details of
-- security-definer operation functions, not client-facing tenant resources.
-- Their household_id columns still scope all server work, while deny-all RLS
-- plus revoked client grants deliberately replaces the usual tenant policy.

comment on table public.calendar_event_deletion_snapshots is
  'Internal server-only table: household_id scopes security-definer calendar deletion snapshot work; RLS is intentionally deny-all and client grants are revoked, so no tenant client policy is defined.';

comment on table public.household_grocery_purchase_occurrences is
  'Internal server-only table: household_id scopes security-definer purchase-occurrence replay protection; RLS is intentionally deny-all and client grants are revoked, so no tenant client policy is defined.';
