-- Corrective migration: deleting an account left a spent invite unsatisfiable.
--
-- `household_invites.redeemed_by` referenced `auth.users` with ON DELETE SET
-- NULL, but the table also requires `redeemed_at` and `redeemed_by` to be null
-- or non-null together. Removing the `auth.users` row of a member who joined by
-- invite therefore tried to null only `redeemed_by` and failed the check
-- constraint — so a partner could never actually delete their account, even
-- though `admin_prepare_account_deletion` had accepted the request.
--
-- A spent invite belongs to the member who redeemed it; when that account is
-- deleted, the invite record goes with it. `created_by` keeps its ON DELETE
-- RESTRICT and is still reassigned to the surviving owner by
-- `mobile_reassign_authorship`, so an invite the *creator* left behind survives.

alter table public.household_invites
  drop constraint household_invites_redeemed_by_fkey;

alter table public.household_invites
  add constraint household_invites_redeemed_by_fkey
  foreign key (redeemed_by) references auth.users(id) on delete cascade;
